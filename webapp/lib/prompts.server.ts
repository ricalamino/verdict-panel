import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RESEARCH_MAX_SEARCHES } from "./defaults";
import type { Locale } from "./i18n";

/**
 * Server-only prompt loader. Kept out of lib/prompts.ts because that module is
 * reachable from the client bundle, and `node:fs` there breaks the build.
 *
 * Resolves against process.cwd(): `webapp/prompts` in dev, `/app/prompts` in the
 * standalone Docker image (see Dockerfile + next.config.ts outputFileTracingIncludes).
 */
const PROMPTS_DIR = join(process.cwd(), "prompts");

const cache = new Map<string, string>();

function load(locale: Locale, name: string): string {
  const key = `${locale}/${name}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const path = join(PROMPTS_DIR, locale, `${name}.md`);
  let text: string;
  try {
    text = readFileSync(path, "utf8").trim();
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Could not read prompt file ${path}: ${reason}`);
  }
  if (!text) throw new Error(`Prompt file ${path} is empty`);

  cache.set(key, text);
  return text;
}

/** Parallel research axes — each gets its own call with a small search budget. */
export type ResearchAxisId = "incumbentes" | "substituto" | "pagamento";

export const RESEARCH_AXIS_IDS: ResearchAxisId[] = [
  "incumbentes",
  "substituto",
  "pagamento",
];

type AxisCopy = { brief: string; schema: string };

const AXIS_PT: Record<ResearchAxisId, AxisCopy> = {
  incumbentes: {
    brief:
      "EIXO A — INCUMBENTES + PREÇO-ÂNCORA.\n" +
      "Quem já vende isso hoje. Priorize a PÁGINA DE PREÇOS do próprio produto.\n" +
      "Registre nome, URL, oferta, preço (ou 'não público — exige contato').\n" +
      "Preencha preco_ancora com o melhor teto público que achar.",
    schema: `{
  "mercado": { "pais": "", "idioma_busca": "", "termos_usados": [] },
  "execucao": { "2_incumbentes_preco": [] },
  "incumbentes": [
    { "nome": "", "url": "", "oferta": "", "preco": "", "escala": "", "fonte": "" }
  ],
  "preco_ancora": { "valor": "", "base": "", "fonte": "" },
  "lacunas_bloqueantes": [],
  "lacunas": [],
  "fatos": [
    { "id": "F1", "afirmacao": "", "fonte": "url", "data": "YYYY-MM" }
  ]
}`,
  },
  substituto: {
    brief:
      "EIXO B — SUBSTITUTO GRATUITO + INSUMO.\n" +
      "Existe versão grátis, open source, dados abertos, API pública, scraper?\n" +
      "A matéria-prima é pública/gratuita/licenciada/proprietária? Quem controla?\n" +
      "Esta é a busca que mais mata ideias.",
    schema: `{
  "mercado": { "pais": "", "idioma_busca": "", "termos_usados": [] },
  "execucao": { "3_substituto_gratuito": [] },
  "substitutos_gratuitos": [
    { "nome": "", "url": "", "cobertura": "", "fonte": "" }
  ],
  "insumo": {
    "natureza": "publico|gratuito|licenciado|proprietario",
    "controlador": "", "mudancas_recentes": "", "fonte": ""
  },
  "lacunas_bloqueantes": [],
  "lacunas": [],
  "fatos": [
    { "id": "F1", "afirmacao": "", "fonte": "url", "data": "YYYY-MM" }
  ]
}`,
  },
  pagamento: {
    brief:
      "EIXO C — EVIDÊNCIA DE PAGAMENTO + PRIOR ART.\n" +
      "Prova de que alguém paga por isso hoje (planos, cases, contratos, reviews).\n" +
      "Alguém já tentou e morreu? Postmortem, 'encerramos', 'shutting down'.\n" +
      "Ausência de evidência de pagamento é um achado — registre em lacunas,\n" +
      "não invente. Só vira lacuna_bloqueante se NÃO houver sequer sinal fraco\n" +
      "E a tese do produto depende de receita recorrente comprovável agora.",
    schema: `{
  "mercado": { "pais": "", "idioma_busca": "", "termos_usados": [] },
  "execucao": { "4_pagamento_prior_art": [] },
  "evidencia_de_pagamento": [ { "afirmacao": "", "fonte": "" } ],
  "prior_art": [ { "nome": "", "desfecho": "", "fonte": "" } ],
  "lacunas_bloqueantes": [],
  "lacunas": [],
  "fatos": [
    { "id": "F1", "afirmacao": "", "fonte": "url", "data": "YYYY-MM" }
  ]
}`,
  },
};

const AXIS_EN: Record<ResearchAxisId, AxisCopy> = {
  incumbentes: {
    brief:
      "AXIS A — INCUMBENTS + ANCHOR PRICE.\n" +
      "Who already sells this today. Prefer the product's own PRICING PAGE.\n" +
      "Record name, URL, offering, price (or 'not public — requires contact').\n" +
      "Fill preco_ancora with the best public ceiling you find.",
    schema: `{
  "mercado": { "pais": "", "idioma_busca": "", "termos_usados": [] },
  "execucao": { "2_incumbentes_preco": [] },
  "incumbentes": [
    { "nome": "", "url": "", "oferta": "", "preco": "", "escala": "", "fonte": "" }
  ],
  "preco_ancora": { "valor": "", "base": "", "fonte": "" },
  "lacunas_bloqueantes": [],
  "lacunas": [],
  "fatos": [
    { "id": "F1", "afirmacao": "", "fonte": "url", "data": "YYYY-MM" }
  ]
}`,
  },
  substituto: {
    brief:
      "AXIS B — FREE SUBSTITUTE + INPUT.\n" +
      "Is there a free, open source, open-data, public-API, or scraper version?\n" +
      "Is the raw material public/free/licensed/proprietary? Who controls it?\n" +
      "This is the search that kills the most ideas.",
    schema: `{
  "mercado": { "pais": "", "idioma_busca": "", "termos_usados": [] },
  "execucao": { "3_substituto_gratuito": [] },
  "substitutos_gratuitos": [
    { "nome": "", "url": "", "cobertura": "", "fonte": "" }
  ],
  "insumo": {
    "natureza": "publico|gratuito|licenciado|proprietario",
    "controlador": "", "mudancas_recentes": "", "fonte": ""
  },
  "lacunas_bloqueantes": [],
  "lacunas": [],
  "fatos": [
    { "id": "F1", "afirmacao": "", "fonte": "url", "data": "YYYY-MM" }
  ]
}`,
  },
  pagamento: {
    brief:
      "AXIS C — EVIDENCE OF PAYMENT + PRIOR ART.\n" +
      "Proof someone pays today (plans, case studies, contracts, reviews).\n" +
      "Has anyone tried and died? Postmortem, 'shutting down', 'discontinued'.\n" +
      "Absence of payment evidence is a finding — record it in lacunas, do not\n" +
      "invent. It is lacuna_bloqueante ONLY if there is not even a weak signal\n" +
      "AND the product thesis depends on proven recurring revenue right now.",
    schema: `{
  "mercado": { "pais": "", "idioma_busca": "", "termos_usados": [] },
  "execucao": { "4_pagamento_prior_art": [] },
  "evidencia_de_pagamento": [ { "afirmacao": "", "fonte": "" } ],
  "prior_art": [ { "nome": "", "desfecho": "", "fonte": "" } ],
  "lacunas_bloqueantes": [],
  "lacunas": [],
  "fatos": [
    { "id": "F1", "afirmacao": "", "fonte": "url", "data": "YYYY-MM" }
  ]
}`,
  },
};

export function researcherPrompt(locale: Locale, axis: ResearchAxisId): string {
  const pack = locale === "pt" ? AXIS_PT : AXIS_EN;
  const { brief, schema } = pack[axis];
  return load(locale, "pesquisador")
    .replaceAll("{{MAX_SEARCHES}}", String(RESEARCH_MAX_SEARCHES))
    .replaceAll("{{AXIS_BRIEF}}", brief)
    .replaceAll("{{AXIS_SCHEMA}}", schema);
}

export function evidenceRules(locale: Locale): string {
  return load(locale, "regras_evidencia");
}
