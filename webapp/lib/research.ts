import type Anthropic from "@anthropic-ai/sdk";
import {
  MAX_TOKENS_RESEARCH,
  RESEARCH_EFFORT,
  RESEARCH_MAX_FACTS,
  RESEARCH_MAX_RESUMES,
  RESEARCH_MAX_SEARCHES,
  RESEARCH_MODEL,
  RESEARCH_TOKEN_BUDGET,
} from "./defaults";
import type { Locale } from "./i18n";
import {
  RESEARCH_AXIS_IDS,
  researcherPrompt,
  type ResearchAxisId,
} from "./prompts.server";

/**
 * Per-axis ceiling. 3.5 min was killing healthy web_search loops AFTER Anthropic
 * had already billed — the client saw a network/timeout error and the $ was gone.
 * Route maxDuration is 10 min; 3 parallel axes share wall clock, then debate.
 */
const REQUEST_TIMEOUT_MS = 6 * 60 * 1000;

export type AxisProgress = {
  axis: ResearchAxisId;
  status: "start" | "done" | "fail";
};

export type Fact = {
  id: string;
  afirmacao: string;
  fonte: string;
  data: string;
  /** Soft facts ([F?] / [F-VF?]) — cannot carry a central thesis. */
  soft?: boolean;
  /** Structured first-hand revenue fields, when applicable. */
  vf?: FirstHandFields;
};

/** Required sub-fields for a hard [F-VF]. Any missing → whole fact is [F-VF?]. */
export const VF_REQUIRED_FIELDS = [
  "valor_mensal",
  "n_clientes",
  "o_que_exatamente_esta_sendo_cobrado",
  "isolado_ou_pacote",
  "meses_de_retencao",
] as const;

export type VfFieldKey = (typeof VF_REQUIRED_FIELDS)[number];

/** EN input aliases → canonical (PT) keys stored on the fact. */
export const VF_KEY_ALIASES: Record<string, VfFieldKey> = {
  valor_mensal: "valor_mensal",
  n_clientes: "n_clientes",
  o_que_exatamente_esta_sendo_cobrado: "o_que_exatamente_esta_sendo_cobrado",
  isolado_ou_pacote: "isolado_ou_pacote",
  meses_de_retencao: "meses_de_retencao",
  monthly_value: "valor_mensal",
  n_customers: "n_clientes",
  what_exactly_is_charged: "o_que_exatamente_esta_sendo_cobrado",
  standalone_or_bundle: "isolado_ou_pacote",
  months_of_retention: "meses_de_retencao",
};

/** Display labels for agents/UI — keep canonical storage, localize the surface. */
export const VF_FIELD_LABELS = {
  en: {
    valor_mensal: "monthly_value",
    n_clientes: "n_customers",
    o_que_exatamente_esta_sendo_cobrado: "what_exactly_is_charged",
    isolado_ou_pacote: "standalone_or_bundle",
    meses_de_retencao: "months_of_retention",
  },
  pt: {
    valor_mensal: "valor_mensal",
    n_clientes: "n_clientes",
    o_que_exatamente_esta_sendo_cobrado: "o_que_exatamente_esta_sendo_cobrado",
    isolado_ou_pacote: "isolado_ou_pacote",
    meses_de_retencao: "meses_de_retencao",
  },
} as const satisfies Record<"en" | "pt", Record<VfFieldKey, string>>;

export type FirstHandFields = {
  valor_mensal: string;
  n_clientes: string;
  o_que_exatamente_esta_sendo_cobrado: string;
  isolado_ou_pacote: string;
  meses_de_retencao: string;
  /** Keys that were blank — present only on soft [F-VF?]. */
  missing?: VfFieldKey[];
};

/** Shape is the researcher's contract; `fatos` + gap lists are load-bearing. */
export type Briefing = {
  fatos: Fact[];
  /** Author-supplied first-hand facts, tagged [F-VF1]… — not from web search. */
  fatos_vf?: Fact[];
  lacunas?: string[];
  lacunas_bloqueantes?: string[];
  /** Code-generated warnings (source concentration, etc.) — visible to agents. */
  alertas?: string[];
  execucao?: Record<string, string[]>;
  preco_ancora?: {
    valor?: string;
    base?: string;
    fonte?: string;
    [k: string]: unknown;
  };
  [key: string]: unknown;
};

export type ResearchAudit = {
  model: string;
  effort: string;
  searches: number;
  resumes: number;
  parseRetries: number;
  /** Summed across every axis/attempt — what the run actually cost. */
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
  };
  /** error_code values from web_search_tool_result blocks (HTTP 200). */
  errors: string[];
  /** Count of result URLs returned across successful web_search_tool_result arrays. */
  searchHits: number;
  /**
   * Lacunas the model wrote that claimed a "parsing/technical" failure while
   * searchHits > 0 — rewritten in code. Proof the excuse was invented.
   */
  excusesScrubbed: string[];
  /**
   * Raw server_tool_use + web_search_tool_result blocks — WRITE-ONLY audit
   * artifact for the JSON export. NEVER re-injected into model context.
   */
  blocks: unknown[];
  /** Per-axis usage, for diagnosing which axis blew up. */
  axes?: Record<
    string,
    {
      searches: number;
      inputTokens: number;
      outputTokens: number;
      searchHits: number;
    }
  >;
};

export type ResearchResult = { briefing: Briefing; audit: ResearchAudit };

export class ResearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchError";
  }
}

const JSON_ONLY_ASK =
  "Return ONLY the JSON object described in your instructions, built from the " +
  "research you already did above. No fences, no preamble, no commentary. " +
  "Do not search again.";

/**
 * Three focused axes in parallel. Each keeps a small tool-loop context
 * (superlinear cost stays local). Merge + renumber fatos in code.
 */
export async function runResearcher(
  client: Anthropic,
  idea: string,
  guidelines: string,
  locale: Locale,
  signal?: AbortSignal,
  onProgress?: (p: AxisProgress) => void,
): Promise<ResearchResult> {
  const settled = await Promise.all(
    RESEARCH_AXIS_IDS.map(async (axis) => {
      onProgress?.({ axis, status: "start" });
      const result = await runAxis(
        client,
        axis,
        idea,
        guidelines,
        locale,
        signal,
      );
      onProgress?.({
        axis,
        status: result.briefing ? "done" : "fail",
      });
      return result;
    }),
  );

  if (signal?.aborted) {
    const err = new Error("Aborted");
    err.name = "AbortError";
    throw err;
  }

  const audit = emptyAudit();
  const parts: Briefing[] = [];
  const failures: string[] = [];

  for (const result of settled) {
    mergeAudit(audit, result.audit, result.axis);
    if (result.briefing) {
      parts.push(result.briefing);
    } else {
      failures.push(`${result.axis}: ${result.error ?? "unknown failure"}`);
    }
  }

  if (!parts.length) {
    throw new ResearchError(
      `All research axes failed (${usageSummary(audit)}). ${failures.join(" | ")}`,
    );
  }

  if (failures.length) {
    console.error(
      `[researcher] partial axes ok=${parts.length} failed=${failures.length}: ` +
        failures.join(" | "),
    );
  }

  const briefing = mergeBriefings(parts);
  // Partial failure is itself a gap — visible to agents, not a hard crash.
  if (failures.length) {
    briefing.lacunas = [
      ...(briefing.lacunas ?? []),
      ...failures.map((f) => `eixo falhou: ${f}`),
    ];
  }

  scrubParseExcuses(briefing, audit);

  console.error(
    `[researcher] merged axes=${parts.length}/${RESEARCH_AXIS_IDS.length} ` +
      `fatos=${briefing.fatos.length} hits=${audit.searchHits} ` +
      `excusesScrubbed=${audit.excusesScrubbed.length} ${usageSummary(audit)}`,
  );

  return { briefing, audit };
}

type AxisOutcome = {
  axis: ResearchAxisId;
  briefing: Briefing | null;
  audit: ResearchAudit;
  error?: string;
};

async function runAxis(
  client: Anthropic,
  axis: ResearchAxisId,
  idea: string,
  guidelines: string,
  locale: Locale,
  signal?: AbortSignal,
): Promise<AxisOutcome> {
  const audit = emptyAudit();
  try {
    const briefing = await runAxisCall(
      client,
      axis,
      idea,
      guidelines,
      locale,
      audit,
      signal,
    );
    return { axis, briefing, audit };
  } catch (err) {
    const msg = message(err);
    console.error(`[researcher] axis=${axis} FAILED: ${msg} | ${usageSummary(audit)}`);
    return { axis, briefing: null, audit, error: msg };
  }
}

async function runAxisCall(
  client: Anthropic,
  axis: ResearchAxisId,
  idea: string,
  guidelines: string,
  locale: Locale,
  audit: ResearchAudit,
  signal?: AbortSignal,
): Promise<Briefing> {
  const system = researcherPrompt(locale, axis);

  const location =
    locale === "pt"
      ? {
          user_location: {
            type: "approximate" as const,
            country: "BR",
            timezone: "America/Sao_Paulo",
          },
        }
      : {};

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `## IDEA\n${idea}\n\n## GUIDELINES & CONTEXT\n${guidelines}`,
    },
  ];

  const remainingSearches = () =>
    Math.max(0, RESEARCH_MAX_SEARCHES - audit.searches);

  const call = (withTools: boolean) => {
    const left = remainingSearches();
    if (withTools && left <= 0) {
      throw new ResearchError(
        `Axis ${axis}: search budget exhausted (${usageSummary(audit)})`,
      );
    }

    const tools: Anthropic.WebSearchTool20260209[] | undefined = withTools
      ? [
          {
            type: "web_search_20260209",
            name: "web_search",
            max_uses: left,
            ...location,
          },
        ]
      : undefined;

    return client.messages.create(
      {
        model: RESEARCH_MODEL,
        max_tokens: MAX_TOKENS_RESEARCH,
        output_config: { effort: RESEARCH_EFFORT },
        system,
        messages,
        ...(tools ? { tools } : {}),
      },
      { timeout: REQUEST_TIMEOUT_MS, signal, maxRetries: 0 },
    );
  };

  let res = await call(true);
  collect(res, audit, `${axis}/attempt-1`);
  assertUsable(res);

  while (res.stop_reason === "pause_turn" && audit.resumes < RESEARCH_MAX_RESUMES) {
    const over = overBudget(audit);
    const left = remainingSearches();
    if (over && left > 0) {
      console.error(
        `[researcher] ${axis} budget soft-cap mid-pause (${usageSummary(audit)}); ` +
          `forcing JSON finalize`,
      );
    }
    audit.resumes++;
    messages.push({ role: "assistant", content: res.content });
    if (left === 0 || over) {
      messages.push({ role: "user", content: JSON_ONLY_ASK });
      res = await call(false);
    } else {
      res = await call(true);
    }
    collect(res, audit, `${axis}/resume-${audit.resumes}`);
    assertUsable(res);
  }

  if (res.stop_reason === "pause_turn") {
    throw new ResearchError(
      `Axis ${axis} still paused after ${RESEARCH_MAX_RESUMES} resumes ` +
        `(${usageSummary(audit)})`,
    );
  }

  try {
    return parseBriefing(textOf(res.content));
  } catch (firstErr) {
    if (res.stop_reason === "max_tokens") {
      throw new ResearchError(
        `Axis ${axis} hit max_tokens (${MAX_TOKENS_RESEARCH}) ` +
          `after ${usageSummary(audit)}. ${message(firstErr)}`,
      );
    }
    if (overBudget(audit)) {
      throw new ResearchError(
        `Axis ${axis} unparseable and over budget (${usageSummary(audit)}). ` +
          message(firstErr),
      );
    }

    audit.parseRetries++;
    messages.push({ role: "assistant", content: res.content });
    messages.push({ role: "user", content: JSON_ONLY_ASK });
    const retry = await call(false);
    collect(retry, audit, `${axis}/parse-retry`);
    assertUsable(retry);

    try {
      return parseBriefing(textOf(retry.content));
    } catch (secondErr) {
      throw new ResearchError(
        `Axis ${axis} unparseable twice (${usageSummary(audit)}). ` +
          `First: ${message(firstErr)} | Retry: ${message(secondErr)}`,
      );
    }
  }
}

function emptyAudit(): ResearchAudit {
  return {
    model: RESEARCH_MODEL,
    effort: RESEARCH_EFFORT,
    searches: 0,
    resumes: 0,
    parseRetries: 0,
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
    errors: [],
    searchHits: 0,
    excusesScrubbed: [],
    blocks: [],
    axes: {},
  };
}

function mergeAudit(
  into: ResearchAudit,
  from: ResearchAudit,
  axis: ResearchAxisId,
) {
  into.searches += from.searches;
  into.resumes += from.resumes;
  into.parseRetries += from.parseRetries;
  into.usage.inputTokens += from.usage.inputTokens;
  into.usage.outputTokens += from.usage.outputTokens;
  into.usage.cacheReadTokens += from.usage.cacheReadTokens;
  into.errors.push(...from.errors);
  into.searchHits += from.searchHits;
  into.excusesScrubbed.push(...from.excusesScrubbed);
  // Write-only: kept for export, never fed back to a model.
  into.blocks.push(...from.blocks);
  into.axes = into.axes ?? {};
  into.axes[axis] = {
    searches: from.searches,
    inputTokens: from.usage.inputTokens,
    outputTokens: from.usage.outputTokens,
    searchHits: from.searchHits,
  };
}

/** Merge axis fragments: concat lists, prefer non-empty scalars, renumber fatos. */
export function mergeBriefings(parts: Briefing[]): Briefing {
  const fatosRaw: Fact[] = [];
  const lacunas: string[] = [];
  const lacunas_bloqueantes: string[] = [];
  const execucao: Record<string, string[]> = {};
  let mercado: unknown;
  let job: unknown;
  let preco_ancora: Briefing["preco_ancora"];
  let incumbentes: unknown[] = [];
  let substitutos_gratuitos: unknown[] = [];
  let insumo: unknown;
  let evidencia_de_pagamento: unknown[] = [];
  let prior_art: unknown[] = [];

  for (const p of parts) {
    fatosRaw.push(...(p.fatos ?? []));
    lacunas.push(...(p.lacunas ?? []));
    lacunas_bloqueantes.push(...(p.lacunas_bloqueantes ?? []));
    Object.assign(execucao, normalizeExecucao(p.execucao));
    if (!mercado && p.mercado) mercado = p.mercado;
    if (!job && p.job) job = p.job;
    if (
      !preco_ancora?.valor &&
      p.preco_ancora &&
      typeof p.preco_ancora === "object"
    ) {
      preco_ancora = p.preco_ancora;
    }
    if (Array.isArray(p.incumbentes)) incumbentes = incumbentes.concat(p.incumbentes);
    if (Array.isArray(p.substitutos_gratuitos)) {
      substitutos_gratuitos = substitutos_gratuitos.concat(p.substitutos_gratuitos);
    }
    if (!insumo && p.insumo) insumo = p.insumo;
    if (Array.isArray(p.evidencia_de_pagamento)) {
      evidencia_de_pagamento = evidencia_de_pagamento.concat(
        p.evidencia_de_pagamento,
      );
    }
    if (Array.isArray(p.prior_art)) prior_art = prior_art.concat(p.prior_art);
  }

  const fatos = classifyAndNumberFacts(fatosRaw.slice(0, RESEARCH_MAX_FACTS));
  const alertas = sourceConcentrationAlerts(fatos);

  return {
    mercado: mercado ?? { pais: "", idioma_busca: "", termos_usados: [] },
    job,
    execucao,
    incumbentes,
    substitutos_gratuitos,
    insumo: insumo ?? {
      natureza: "",
      controlador: "",
      mudancas_recentes: "",
      fonte: "",
    },
    preco_ancora: preco_ancora ?? { valor: "", base: "", fonte: "" },
    evidencia_de_pagamento,
    prior_art,
    lacunas: uniq(lacunas),
    // Trust the model: do NOT auto-promote empty preco_ancora to blocking.
    // B2B SaaS often hides price behind a lead form — that is a finding.
    lacunas_bloqueantes: uniq(lacunas_bloqueantes),
    alertas,
    fatos,
  };
}

/** Undated or older than 24 months → soft [F?]; else hard [F]. */
export function classifyAndNumberFacts(raw: Fact[], now = new Date()): Fact[] {
  let hard = 0;
  let soft = 0;
  return raw.map((f) => {
    const isSoft = isStaleOrUndated(f.data, now);
    if (isSoft) {
      soft++;
      return { ...f, soft: true, id: `F?${soft}` };
    }
    hard++;
    return { ...f, soft: false, id: `F${hard}` };
  });
}

export function isStaleOrUndated(data: string, now = new Date()): boolean {
  const t = data.trim();
  if (!t || /^(sem data|n\/?a|unknown|ausente)/i.test(t)) return true;
  const m = t.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return true;
  const year = Number(m[1]);
  const month = m[2] ? Number(m[2]) : 1;
  const day = m[3] ? Number(m[3]) : 1;
  if (year < 1990 || year > now.getFullYear() + 1) return true;
  const then = new Date(year, month - 1, day);
  const months =
    (now.getFullYear() - then.getFullYear()) * 12 +
    (now.getMonth() - then.getMonth());
  return months >= 24;
}

/** Hostname from a fonte URL/string, or null if unparseable. */
export function domainOf(fonte: string): string | null {
  const raw = fonte.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * If one domain owns >40% of web facts, the briefing is reading a press release.
 * Emitted as alertas — agents must discount that cluster.
 */
export function sourceConcentrationAlerts(
  fatos: Fact[],
  threshold = 0.4,
): string[] {
  if (fatos.length < 3) return [];
  const counts = new Map<string, number>();
  for (const f of fatos) {
    const d = domainOf(f.fonte);
    if (!d) continue;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const n = fatos.length;
  const alerts: string[] = [];
  for (const [d, c] of counts) {
    if (c / n > threshold) {
      alerts.push(
        `concentração de fonte: ${c}/${n} fatos de ${d} (>40%) — ` +
          `briefing enviesado; marketing de um player não é evidência de mercado`,
      );
    }
  }
  return alerts;
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function collect(res: Anthropic.Message, audit: ResearchAudit, label: string) {
  audit.usage.inputTokens += res.usage.input_tokens;
  audit.usage.outputTokens += res.usage.output_tokens;
  audit.usage.cacheReadTokens += res.usage.cache_read_input_tokens ?? 0;
  audit.searches += res.usage.server_tool_use?.web_search_requests ?? 0;

  let hitsThisCall = 0;
  let errorsThisCall = 0;

  for (const block of res.content) {
    if (block.type === "server_tool_use") {
      audit.blocks.push(block);
      continue;
    }
    if (block.type === "web_search_tool_result") {
      audit.blocks.push(block);
      if (Array.isArray(block.content)) {
        hitsThisCall += block.content.length;
        audit.searchHits += block.content.length;
      } else {
        errorsThisCall++;
        audit.errors.push(block.content.error_code);
      }
    }
  }

  console.error(
    `[researcher] ${label} model=${res.model} stop=${res.stop_reason} ` +
      `in=${res.usage.input_tokens} out=${res.usage.output_tokens} ` +
      `cacheRead=${res.usage.cache_read_input_tokens ?? 0} ` +
      `searches=${res.usage.server_tool_use?.web_search_requests ?? 0} ` +
      `hits=${hitsThisCall} toolErrors=${errorsThisCall} | ` +
      `axis-cumulative in=${audit.usage.inputTokens} out=${audit.usage.outputTokens} ` +
      `searches=${audit.searches} hits=${audit.searchHits}`,
  );
}

/**
 * The model invents infrastructure excuses ("parsing error", "Python execution
 * error") when it doesn't want to extract from returned results. We do NOT
 * parse web_search_tool_result into the briefing — the API puts results in the
 * model's context. If searchHits > 0, those excuses are lies.
 */
const PARSE_EXCUSE_RE =
  /falha t[eé]cnica|erro de parsing|parsing error|processamento dos resultados|n[aã]o (consegui|foi poss[ií]vel) (extrair|processar)|could not extract|technical failure.*result|erro de execu[cç][aã]o\s*python|python\s*(error|exception|traceback)|n[aã]o erro da ferramenta|erro da ferramenta de busca|autodiagn[oó]stico|script\s*(falhou|error|failed)|ferramenta de busca.*(falhou|erro)|tool\s*(execution\s*)?(error|failure)/i;

export function scrubParseExcuses(
  briefing: Briefing,
  audit: ResearchAudit,
): void {
  if (audit.searchHits <= 0) return;

  const rewrite = (list: string[] | undefined): string[] => {
    if (!list?.length) return list ?? [];
    const out: string[] = [];
    for (const g of list) {
      if (PARSE_EXCUSE_RE.test(g)) {
        audit.excusesScrubbed.push(g);
        out.push(
          `[desculpa-técnica-descartada; ${audit.searchHits} resultados ` +
            `web_search chegaram intactos; toolErrors=${audit.errors.length}] ` +
            g.replace(PARSE_EXCUSE_RE, "RESULTADOS_VIERAM_mas_modelo_alegou_falha"),
        );
      } else {
        out.push(g);
      }
    }
    return out;
  };

  briefing.lacunas = rewrite(briefing.lacunas);
  briefing.lacunas_bloqueantes = rewrite(briefing.lacunas_bloqueantes);

  if (audit.excusesScrubbed.length) {
    console.error(
      `[researcher] scrubbed ${audit.excusesScrubbed.length} technical-excuse lacuna(s) ` +
        `with searchHits=${audit.searchHits} toolErrors=${audit.errors.length}`,
    );
  }
}

function usageSummary(audit: ResearchAudit): string {
  const { inputTokens, outputTokens } = audit.usage;
  return (
    `${inputTokens} in + ${outputTokens} out tokens, ` +
    `${audit.searches} searches, ${audit.resumes} resumes`
  );
}

function overBudget(audit: ResearchAudit): boolean {
  return (
    audit.usage.inputTokens + audit.usage.outputTokens > RESEARCH_TOKEN_BUDGET
  );
}

function assertUsable(res: Anthropic.Message) {
  if (res.stop_reason === "refusal") {
    throw new ResearchError(
      "The researcher request was declined by safety classifiers " +
        "(stop_reason: refusal). Rephrase the idea.",
    );
  }
}

/** Exported for tests. Throws on anything that isn't a usable briefing fragment. */
export function parseBriefing(text: string): Briefing {
  if (!text) throw new Error("empty response text");

  const parsed: unknown = JSON.parse(extractJson(text));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("top-level value is not a JSON object");
  }

  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.fatos)) {
    throw new Error('missing "fatos" array');
  }

  // Per-axis cap 4; merge applies the global cap + renumber.
  const fatos: Fact[] = obj.fatos.slice(0, 4).map((raw, i) => {
    const f = (raw && typeof raw === "object" ? raw : {}) as Record<
      string,
      unknown
    >;
    return {
      id: `F${i + 1}`,
      afirmacao: str(f.afirmacao),
      fonte: str(f.fonte),
      data: str(f.data),
    };
  });

  return {
    ...obj,
    fatos,
    lacunas: stringList(obj.lacunas),
    lacunas_bloqueantes: stringList(obj.lacunas_bloqueantes),
    execucao: normalizeExecucao(obj.execucao),
  };
}

function stringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((g): g is string => typeof g === "string" && g.trim().length > 0)
    .map((g) => g.trim());
}

function normalizeExecucao(v: unknown): Record<string, string[]> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    out[k] = stringList(raw);
  }
  return out;
}

function uniq(items: string[]): string[] {
  return [...new Set(items)];
}

/** Tolerates ```json fences and stray prose around the object. */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return body;
  return body.slice(start, end + 1);
}

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export type BriefingRenderLabels = {
  emptyNotice: string;
  factsHeader: string;
  firstHandHeader: string;
  blockingGapsHeader: string;
  gapsHeader: string;
  alertsHeader: string;
  /** Localized display names for VF sub-fields (canonical key → label). */
  vfFieldLabels: Record<VfFieldKey, string>;
};

/**
 * Parse author textarea into structured [F-VF] / [F-VF?] facts.
 * Blocks separated by a blank line. Each block MUST supply every sub-field
 * (PT or EN keys accepted; stored under canonical PT keys).
 * Any missing sub-field → the whole fact is soft [F-VF?] (weighs as [P]).
 * Free-text without keys is incomplete by definition — no inference allowed.
 */
export function parseFirstHandEvidence(raw: string): Fact[] {
  const blocks = raw
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 8);

  let hard = 0;
  let softN = 0;
  const out: Fact[] = [];

  for (const block of blocks) {
    const fields = parseVfBlock(block);
    const missing = VF_REQUIRED_FIELDS.filter((k) => !fields[k].trim());
    const complete = missing.length === 0;
    const afirmacao = formatVfClaim(fields, missing);

    if (complete) {
      hard++;
      out.push({
        id: `F-VF${hard}`,
        afirmacao,
        fonte: "autor / first-hand",
        data: "",
        soft: false,
        vf: { ...fields },
      });
    } else {
      softN++;
      out.push({
        id: `F-VF?${softN}`,
        afirmacao,
        fonte: "autor / first-hand",
        data: "",
        soft: true,
        vf: { ...fields, missing },
      });
    }
  }
  return out;
}

function emptyVfFields(): Record<VfFieldKey, string> {
  return {
    valor_mensal: "",
    n_clientes: "",
    o_que_exatamente_esta_sendo_cobrado: "",
    isolado_ou_pacote: "",
    meses_de_retencao: "",
  };
}

/** Accepts PT or EN `key: value` lines; unknown keys ignored; free prose → all empty. */
export function parseVfBlock(block: string): Record<VfFieldKey, string> {
  const fields = emptyVfFields();
  const lines = block
    .split("\n")
    .map((l) => l.replace(/^\[?\s*F-?VF\??\d*\s*\]?\s*/i, "").trim())
    .filter(Boolean);

  const keyAlt = Object.keys(VF_KEY_ALIASES).join("|");
  const keyRe = new RegExp(`^(${keyAlt})\\s*[:=]\\s*(.*)$`, "i");

  let sawKey = false;
  for (const line of lines) {
    const m = line.match(keyRe);
    if (!m) continue;
    sawKey = true;
    const canonical = VF_KEY_ALIASES[m[1].toLowerCase()];
    if (!canonical) continue;
    fields[canonical] = m[2].trim();
  }

  // A lone prose paragraph with no keys is incomplete — do not treat the
  // whole text as monthly_value / valor_mensal or any other field.
  if (!sawKey) return emptyVfFields();
  return fields;
}

function formatVfClaim(
  fields: Record<VfFieldKey, string>,
  missing: VfFieldKey[],
): string {
  const bits = VF_REQUIRED_FIELDS.map((k) => {
    const v = fields[k].trim();
    const label = VF_FIELD_LABELS.en[k];
    return v ? `${label}=${v}` : `${label}=(missing)`;
  });
  const miss =
    missing.length > 0
      ? ` | incomplete: ${missing.map((k) => VF_FIELD_LABELS.en[k]).join(", ")}`
      : "";
  return bits.join("; ") + miss;
}

/** Full briefing block for the shared (cacheable) system prefix. */
export function renderBriefingContext(
  briefing: Briefing,
  labels: BriefingRenderLabels,
): string {
  const parts: string[] = [];

  const job = briefing.job;
  if (job && typeof job === "object" && !Array.isArray(job)) {
    const j = job as Record<string, unknown>;
    const enunciado = typeof j.enunciado === "string" ? j.enunciado.trim() : "";
    const paga =
      typeof j.como_o_icp_paga_hoje === "string"
        ? j.como_o_icp_paga_hoje.trim()
        : "";
    if (enunciado) {
      parts.push(
        `### JOB (category / job-to-be-done — score payment here, not on the wedge)\n` +
          `${enunciado}` +
          (paga ? `\nHow ICP pays today: ${paga}` : ""),
      );
    }
  }

  const vf = briefing.fatos_vf ?? [];
  if (vf.length) {
    parts.push(
      `### ${labels.firstHandHeader}\n` +
        vf
          .map((f) => {
            const softNote = f.soft
              ? " [F-VF? soft — missing required sub-field(s); weighs as [P]; agents MUST NOT infer absent fields]"
              : "";
            const detail = f.vf
              ? "\n" +
                VF_REQUIRED_FIELDS.map((k) => {
                  const v = f.vf?.[k]?.trim();
                  const label = labels.vfFieldLabels[k];
                  return `  - ${label}: ${v || "(missing)"}`;
                }).join("\n")
              : "";
            return `[${f.id}]${softNote}${detail || ` ${f.afirmacao}`}`;
          })
          .join("\n"),
    );
  }

  const alerts = briefing.alertas ?? [];
  if (alerts.length) {
    parts.push(
      `### ${labels.alertsHeader}\n` + alerts.map((a) => `- ${a}`).join("\n"),
    );
  }

  if (!briefing.fatos.length) {
    parts.push(labels.emptyNotice);
  } else {
    parts.push(
      briefing.fatos
        .map((f) => {
          const softNote = f.soft
            ? " [F? soft — undated or >24mo; cannot carry central thesis]"
            : "";
          const bits = [
            f.fonte ? `fonte: ${f.fonte}` : "",
            f.data ? `data: ${f.data}` : "data: (ausente)",
          ].filter(Boolean);
          return `[${f.id}] ${f.afirmacao}${softNote}${bits.length ? ` — ${bits.join(" · ")}` : ""}`;
        })
        .join("\n"),
    );
  }

  const blocking = briefing.lacunas_bloqueantes ?? [];
  if (blocking.length) {
    parts.push(
      `### ${labels.blockingGapsHeader}\n` +
        blocking.map((g) => `- ${g}`).join("\n"),
    );
  }

  const gaps = briefing.lacunas ?? [];
  if (gaps.length) {
    parts.push(
      `### ${labels.gapsHeader}\n` + gaps.map((g) => `- ${g}`).join("\n"),
    );
  }

  return parts.join("\n\n");
}

/** @deprecated Prefer renderBriefingContext. */
export function renderFacts(facts: Fact[], emptyNotice: string): string {
  if (!facts.length) return emptyNotice;
  return facts
    .map((f) => {
      const bits = [
        f.fonte ? `fonte: ${f.fonte}` : "",
        f.data ? `data: ${f.data}` : "",
      ].filter(Boolean);
      return `[${f.id}] ${f.afirmacao}${bits.length ? ` — ${bits.join(" · ")}` : ""}`;
    })
    .join("\n");
}
