import Anthropic from "@anthropic-ai/sdk";
import {
  JUDGE_MODEL,
  MAX_TOKENS_JUDGE,
  MAX_TOKENS_PANEL,
  MAX_TOKENS_REFINE,
  PANEL_MODEL,
  REFINE_MODEL,
  REPLY_ROUNDS,
} from "./defaults";
import type { Locale, RoleId } from "./i18n";
import { ROLE_IDS } from "./i18n";
import { getPrompts, roleLabel } from "./prompts";
import { evidenceRules } from "./prompts.server";
import {
  parseFirstHandEvidence,
  renderBriefingContext,
  runResearcher,
  VF_FIELD_LABELS,
  type Briefing,
  type ResearchAudit,
} from "./research";

export type Role = RoleId;

export type TranscriptEntry = {
  role: RoleId;
  roleLabel: string;
  text: string;
  round: "opening" | `reply-${number}`;
};

export function createClient(apiKey: string, workspaceId?: string) {
  const ws = workspaceId?.trim();
  return new Anthropic({
    apiKey,
    ...(ws
      ? { defaultHeaders: { "anthropic-workspace-id": ws } }
      : {}),
  });
}

/** Identity-linked keys (personal / service-account) need a workspace unless scoped. */
export function isWorkspaceIdRequiredError(message: string) {
  return message.includes("anthropic-workspace-id is required");
}

/**
 * Shared prefix (briefing + idea + guidelines [+ evidence rules]) is byte-
 * identical across agents/rounds and marked ephemeral so later calls pay
 * cache-read (~10%) instead of full input. Role/judge text and the turn ask
 * stay OUT of the cached prefix — otherwise one token of drift = 0% hit rate.
 *
 * Cache hash order: tools → system → messages. We have no tools here, so
 * system[0] is the breakpoint.
 */
async function callModel(
  client: Anthropic,
  model: string,
  sharedSystem: string | null,
  roleSystem: string,
  userMessage: string,
  maxTokens: number,
  signal?: AbortSignal,
): Promise<string> {
  const system: Anthropic.TextBlockParam[] = [];
  if (sharedSystem) {
    system.push({
      type: "text",
      text: sharedSystem,
      cache_control: { type: "ephemeral" },
    });
  }
  system.push({ type: "text", text: roleSystem });

  const resp = await client.messages.create(
    {
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    },
    { signal, timeout: 3 * 60 * 1000, maxRetries: 0 },
  );

  const cacheRead = resp.usage.cache_read_input_tokens ?? 0;
  const cacheCreate = resp.usage.cache_creation_input_tokens ?? 0;
  if (cacheRead || cacheCreate) {
    console.error(
      `[panel] cache model=${resp.model} create=${cacheCreate} read=${cacheRead} ` +
        `in=${resp.usage.input_tokens} out=${resp.usage.output_tokens}`,
    );
  }

  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function sharedPrefix(
  idea: string,
  guidelines: string,
  locale: Locale,
  briefingBlock: string,
  withEvidence: boolean,
): string {
  const p = getPrompts(locale);
  const parts: string[] = [];
  if (briefingBlock) {
    parts.push(`## ${p.contextBriefing}\n${briefingBlock}`);
  }
  parts.push(`## ${p.contextIdea}\n${idea}`);
  parts.push(`## ${p.contextGuidelines}\n${guidelines}`);
  if (withEvidence) {
    parts.push(evidenceRules(locale));
  }
  return parts.join("\n\n");
}

export type PanelEvent =
  | { type: "round"; name: string }
  | { type: "progress"; text: string }
  | { type: "heartbeat" }
  | { type: "briefing"; briefing: Briefing; audit: ResearchAudit | null }
  | { type: "speech"; entry: TranscriptEntry }
  | { type: "verdict"; text: string }
  | {
      type: "error";
      message: string;
      needWorkspace?: boolean;
      connection?: boolean;
    }
  | { type: "done" };

export function isAbortError(err: unknown) {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string };
  return (
    e.name === "AbortError" ||
    e.name === "APIUserAbortError" ||
    (typeof e.message === "string" && /aborted/i.test(e.message))
  );
}

function throwIfAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  const err = new Error("Aborted");
  err.name = "AbortError";
  throw err;
}

export async function* runPanel(
  apiKey: string,
  idea: string,
  guidelines: string,
  replyRounds = REPLY_ROUNDS,
  locale: Locale = "en",
  skipResearch = false,
  signal?: AbortSignal,
  firstHandEvidence = "",
  workspaceId?: string,
): AsyncGenerator<PanelEvent> {
  const client = createClient(apiKey, workspaceId);
  const p = getPrompts(locale);
  const fatosVf = parseFirstHandEvidence(firstHandEvidence);

  let briefingBlock = "";
  if (!skipResearch) {
    yield { type: "round", name: p.researchRound };

    const extra: PanelEvent[] = [];
    let tick: (() => void) | undefined;
    let finished = false;
    const researchP = runResearcher(
      client,
      idea,
      guidelines,
      locale,
      signal,
      ({ axis, status }) => {
        extra.push({
          type: "progress",
          text: `${p.researchRound} · ${axis} ${status}`,
        });
        tick?.();
      },
    ).finally(() => {
      finished = true;
      tick?.();
    });

    while (!finished) {
      while (extra.length) yield extra.shift()!;
      if (finished) break;
      await new Promise<void>((resolve) => {
        tick = resolve;
      });
    }
    while (extra.length) yield extra.shift()!;

    const { briefing, audit } = await researchP;
    throwIfAborted(signal);
    briefing.fatos_vf = fatosVf;
    briefingBlock = renderBriefingContext(briefing, {
      emptyNotice: p.briefingEmpty,
      factsHeader: p.contextBriefing,
      firstHandHeader: p.contextFirstHand,
      blockingGapsHeader: p.contextBlockingGaps,
      gapsHeader: p.contextGaps,
      alertsHeader: p.contextAlerts,
      vfFieldLabels: { ...VF_FIELD_LABELS[locale] },
    });
    yield { type: "briefing", briefing, audit };
  } else if (fatosVf.length) {
    // v1 baseline can still carry founder evidence.
    const stub: Briefing = { fatos: [], fatos_vf: fatosVf };
    briefingBlock = renderBriefingContext(stub, {
      emptyNotice: p.briefingEmpty,
      factsHeader: p.contextBriefing,
      firstHandHeader: p.contextFirstHand,
      blockingGapsHeader: p.contextBlockingGaps,
      gapsHeader: p.contextGaps,
      alertsHeader: p.contextAlerts,
      vfFieldLabels: { ...VF_FIELD_LABELS[locale] },
    });
    yield { type: "briefing", briefing: stub, audit: null };
  }

  // Persona / judge only — evidence rules live in the shared cached prefix.
  const roleSystem = (role: RoleId) => p.roles[role];
  const judgeSystem = skipResearch && !fatosVf.length ? p.judge : p.judgeBriefing;
  const shared = sharedPrefix(
    idea,
    guidelines,
    locale,
    briefingBlock,
    !skipResearch || fatosVf.length > 0,
  );

  const transcript: TranscriptEntry[] = [];

  yield { type: "round", name: p.openingRound };

  for (const role of ROLE_IDS) {
    throwIfAborted(signal);
    const text = await callModel(
      client,
      PANEL_MODEL,
      shared,
      roleSystem(role),
      p.openAsk,
      MAX_TOKENS_PANEL,
      signal,
    );
    const entry: TranscriptEntry = {
      role,
      roleLabel: roleLabel(locale, role),
      text,
      round: "opening",
    };
    transcript.push(entry);
    yield { type: "speech", entry };
  }

  for (let r = 1; r <= replyRounds; r++) {
    yield { type: "round", name: p.replyRound(r) };
    const debateSoFar = transcript
      .map((e) => `### ${e.roleLabel}\n${e.text}`)
      .join("\n\n");
    const newRound: TranscriptEntry[] = [];

    for (const role of ROLE_IDS) {
      throwIfAborted(signal);
      const text = await callModel(
        client,
        PANEL_MODEL,
        shared,
        roleSystem(role),
        `## ${p.debateSoFar}\n${debateSoFar}\n\n${p.replyAsk}`,
        MAX_TOKENS_PANEL,
        signal,
      );
      const entry: TranscriptEntry = {
        role,
        roleLabel: roleLabel(locale, role),
        text,
        round: `reply-${r}`,
      };
      newRound.push(entry);
      yield { type: "speech", entry };
    }
    transcript.push(...newRound);
  }

  yield { type: "round", name: p.judgeRound };

  throwIfAborted(signal);

  const debate = transcript
    .map((e) => `### ${e.roleLabel}\n${e.text}`)
    .join("\n\n");
  const verdict = await callModel(
    client,
    JUDGE_MODEL,
    shared,
    judgeSystem,
    `## ${p.fullDebate}\n${debate}\n\n${p.verdictAsk}`,
    MAX_TOKENS_JUDGE,
    signal,
  );

  yield { type: "verdict", text: verdict };
  yield { type: "done" };
}

export async function refineIdea(
  apiKey: string,
  idea: string,
  guidelines: string,
  locale: Locale = "en",
  workspaceId?: string,
): Promise<{ idea: string; guidelines: string }> {
  const client = createClient(apiKey, workspaceId);
  const p = getPrompts(locale);
  const shared = sharedPrefix(idea, guidelines, locale, "", false);
  const raw = await callModel(
    client,
    REFINE_MODEL,
    shared,
    p.refine,
    "Refine the IDEA and GUIDELINES above.",
    MAX_TOKENS_REFINE,
  );

  const ideaRe = new RegExp(
    `##\\s*${p.ideaHeader}\\s*\\n([\\s\\S]*?)(?=\\n##\\s*${p.guidelinesHeader}|$)`,
    "i",
  );
  const guidelinesRe = new RegExp(
    `##\\s*${p.guidelinesHeader}\\s*\\n([\\s\\S]*)$`,
    "i",
  );

  const ideaMatch = raw.match(ideaRe);
  const guidelinesMatch = raw.match(guidelinesRe);

  return {
    idea: ideaMatch?.[1]?.trim() || idea,
    guidelines: guidelinesMatch?.[1]?.trim() || guidelines,
  };
}
