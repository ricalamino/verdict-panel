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
      "EIXO C — EVIDÊNCIA DE PAGAMENTO (JOB-TO-BE-DONE) + PRIOR ART.\n" +
      "NÃO busque se alguém cobra pelo slogan/diferencial do autor\n" +
      "(ex.: 'agente consultor embutido'). Greenfield quase nunca tem preço\n" +
      "público do wedge — isso é lacuna, não morte.\n" +
      "1) Extraia o JOB: o trabalho que o ICP já paga para ter feito hoje\n" +
      "(ferramenta, agência, implementação, freelancer, headcount).\n" +
      "2) Busque prova de que alguém PAGA por esse job: SaaS da categoria,\n" +
      "agência, setup fee, retainer, marketplace de implementação, review\n" +
      "de cliente pagante. Esse é o sinal load-bearing.\n" +
      "3) Alguém já tentou um produto parecido e morreu? Postmortem,\n" +
      "'encerramos', 'shutting down'.\n" +
      "Ausência de pagamento pelo WEDGE → lacuna (não bloqueante).\n" +
      "Ausência de pagamento pela CATEGORIA/job → lacuna; só vira\n" +
      "lacuna_bloqueante se NÃO houver sequer sinal fraco E a tese depende\n" +
      "de receita recorrente comprovável agora.",
    schema: `{
  "mercado": { "pais": "", "idioma_busca": "", "termos_usados": [] },
  "job": { "enunciado": "", "como_o_icp_paga_hoje": "" },
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
      "AXIS C — EVIDENCE OF PAYMENT (JOB-TO-BE-DONE) + PRIOR ART.\n" +
      "Do NOT search whether anyone charges for the author's slogan/\n" +
      "differentiator (e.g. 'embedded AI consultant'). Greenfield almost\n" +
      "never has a public wedge price — that is a gap, not a kill.\n" +
      "1) Extract the JOB: the work the ICP already pays to get done today\n" +
      "(tool, agency, implementation, freelancer, headcount).\n" +
      "2) Find proof someone PAYS for that job: category SaaS, agency,\n" +
      "setup fee, retainer, implementation marketplace, paying-customer\n" +
      "review. That is the load-bearing signal.\n" +
      "3) Has anyone tried a similar product and died? Postmortem,\n" +
      "'shutting down', 'discontinued'.\n" +
      "No payment for the WEDGE → gap (not blocking).\n" +
      "No payment for the CATEGORY/job → gap; it is lacuna_bloqueante ONLY\n" +
      "if there is not even a weak signal AND the thesis depends on proven\n" +
      "recurring revenue right now.",
    schema: `{
  "mercado": { "pais": "", "idioma_busca": "", "termos_usados": [] },
  "job": { "enunciado": "", "como_o_icp_paga_hoje": "" },
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
