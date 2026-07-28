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

export type Role = RoleId;

export type TranscriptEntry = {
  role: RoleId;
  roleLabel: string;
  text: string;
  round: "opening" | `reply-${number}`;
};

export function createClient(apiKey: string) {
  return new Anthropic({ apiKey });
}

async function callModel(
  client: Anthropic,
  model: string,
  system: string,
  userMessage: string,
  maxTokens: number,
): Promise<string> {
  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function contextBlock(
  idea: string,
  guidelines: string,
  locale: Locale,
): string {
  const p = getPrompts(locale);
  return `## ${p.contextIdea}\n${idea}\n\n## ${p.contextGuidelines}\n${guidelines}`;
}

export type PanelEvent =
  | { type: "round"; name: string }
  | { type: "speech"; entry: TranscriptEntry }
  | { type: "verdict"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

export async function* runPanel(
  apiKey: string,
  idea: string,
  guidelines: string,
  replyRounds = REPLY_ROUNDS,
  locale: Locale = "en",
): AsyncGenerator<PanelEvent> {
  const client = createClient(apiKey);
  const p = getPrompts(locale);
  const context = contextBlock(idea, guidelines, locale);
  const transcript: TranscriptEntry[] = [];

  yield { type: "round", name: p.openingRound };

  for (const role of ROLE_IDS) {
    const text = await callModel(
      client,
      PANEL_MODEL,
      p.roles[role],
      `${context}\n\n${p.openAsk}`,
      MAX_TOKENS_PANEL,
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
      const text = await callModel(
        client,
        PANEL_MODEL,
        p.roles[role],
        `${context}\n\n## ${p.debateSoFar}\n${debateSoFar}\n\n${p.replyAsk}`,
        MAX_TOKENS_PANEL,
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

  const debate = transcript
    .map((e) => `### ${e.roleLabel}\n${e.text}`)
    .join("\n\n");
  const verdict = await callModel(
    client,
    JUDGE_MODEL,
    p.judge,
    `${context}\n\n## ${p.fullDebate}\n${debate}\n\n${p.verdictAsk}`,
    MAX_TOKENS_JUDGE,
  );

  yield { type: "verdict", text: verdict };
  yield { type: "done" };
}

export async function refineIdea(
  apiKey: string,
  idea: string,
  guidelines: string,
  locale: Locale = "en",
): Promise<{ idea: string; guidelines: string }> {
  const client = createClient(apiKey);
  const p = getPrompts(locale);
  const raw = await callModel(
    client,
    REFINE_MODEL,
    p.refine,
    contextBlock(idea, guidelines, locale),
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

export function extractVerdictLabel(
  verdict: string,
): "GO" | "NO-GO" | "PIVOT" | null {
  const m = verdict.match(/(?:Verdict|Veredito):\s*(GO|NO-GO|PIVOT)/i);
  if (!m) return null;
  const v = m[1].toUpperCase();
  if (v === "GO" || v === "NO-GO" || v === "PIVOT") return v;
  return null;
}
