export type Locale = "en" | "pt";

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "painel_locale";

export type RoleId = "advocate" | "prosecutor" | "skeptic";

export const ROLE_IDS: RoleId[] = ["advocate", "prosecutor", "skeptic"];

export type Messages = {
  brand: string;
  title: string;
  lede: string;
  apiKeyLabel: string;
  show: string;
  hide: string;
  save: string;
  clear: string;
  keyHint: string;
  keySaved: string;
  ideaLabel: string;
  guidelinesLabel: string;
  replies: string;
  refine: string;
  refining: string;
  run: string;
  stop: string;
  discussion: string;
  openingRound: string;
  replyRound: (n: string) => string;
  judgeRound: string;
  starting: string;
  verdictEyebrow: string;
  saveDiscussion: string;
  footer: string;
  errNeedKey: string;
  errNeedFields: string;
  errRefine: string;
  errPanel: string;
  noVerdict: string;
  roleShort: Record<RoleId, string>;
  roleName: Record<RoleId, string>;
  exportTitle: string;
  exportIdea: string;
  exportGuidelines: string;
  exportDebate: string;
  exportOpening: string;
  exportReply: (n: string) => string;
  exportVerdict: string;
  exportDocTitle: string;
  exportVerdictLabel: string;
  language: string;
  defaultIdea: string;
  defaultGuidelines: string;
};

const en: Messages = {
  brand: "Panel",
  title: "Adversarial project validation",
  lede: "Advocate, Prosecutor, and Market Skeptic debate. The judge issues GO / NO-GO / PIVOT — fragile hypotheses to test with humans, not another AI.",
  apiKeyLabel: "Anthropic API Key",
  show: "Show",
  hide: "Hide",
  save: "Save",
  clear: "Clear",
  keyHint:
    "Stored only in your localStorage — sent to the server only when calling the API.",
  keySaved: " ✓ saved.",
  ideaLabel: "Idea",
  guidelinesLabel: "Guidelines & context",
  replies: "Replies",
  refine: "Refine with AI",
  refining: "Refining…",
  run: "Run discussion",
  stop: "Stop",
  discussion: "Discussion",
  openingRound: "Opening round",
  replyRound: (n) => `Reply ${n}`,
  judgeRound: "Judge verdict",
  starting: "Starting panel",
  verdictEyebrow: "Judge verdict",
  saveDiscussion: "Save discussion",
  footer:
    "Does not replace market validation. The useful part is the fragile hypotheses — test them with humans this week.",
  errNeedKey: "Save the API key first.",
  errNeedFields: "Idea and guidelines are required.",
  errRefine: "Refine failed",
  errPanel: "Panel error",
  noVerdict: "(no verdict)",
  roleShort: {
    advocate: "Defense",
    prosecutor: "Attack",
    skeptic: "Demand",
  },
  roleName: {
    advocate: "Advocate",
    prosecutor: "Prosecutor",
    skeptic: "Market Skeptic",
  },
  exportTitle: "PROJECT VALIDATION PANEL",
  exportIdea: "## IDEA",
  exportGuidelines: "## GUIDELINES",
  exportDebate: "## DEBATE",
  exportOpening: "OPENING ROUND",
  exportReply: (n) => `REPLY ROUND ${n}`,
  exportVerdict: "JUDGE VERDICT",
  exportDocTitle: "Project Validation Panel",
  exportVerdictLabel: "Verdict",
  language: "Language",
  defaultIdea: `What: [product/service in 1–2 sentences — what it delivers, for whom, how]
Format: [SaaS / marketplace / service / content / physical / other]
Problem: [concrete pain someone will pay to solve]
Solution: [how you solve it, no technical fluff]
Who pays: [persona + buying context]
Monetization: [subscription / one-shot / take-rate / freemium / other — approx price if known]`,
  defaultGuidelines: `ICP: [who actually buys — role, company size, budget, purchase trigger]
Status quo: [what they do today without you — spreadsheet, competitor, nothing]
Competition: [direct and indirect alternatives + approx pricing]
Thesis: [why they would switch from status quo to you — 1 sentence]
Unfair advantage: [channel, expertise, audience, cost, distribution — or "none yet"]
Validation constraint: validate in 7 days without building the product; only conversations, pre-sales, or a cheap experiment.
Critical risk: [the assumption that, if false, kills the idea]
Out of scope: [what you will NOT do in this phase]
Budget / time available: [e.g. 5–10h/week, $0 on ads]`,
};

const pt: Messages = {
  brand: "Painel",
  title: "Validação adversarial de projetos",
  lede: "Advogado, Promotor e Cético debatem. O juiz emite GO / NO-GO / PIVOT — hipóteses frágeis pra testar com humanos, não com outra IA.",
  apiKeyLabel: "Anthropic API Key",
  show: "Mostrar",
  hide: "Ocultar",
  save: "Salvar",
  clear: "Limpar",
  keyHint:
    "Persistida só no seu localStorage — enviada ao servidor só na hora da chamada.",
  keySaved: " ✓ salva.",
  ideaLabel: "Ideia",
  guidelinesLabel: "Diretrizes e contexto",
  replies: "Réplicas",
  refine: "Refinar com IA",
  refining: "Refinando…",
  run: "Rodar discussão",
  stop: "Parar",
  discussion: "Discussão",
  openingRound: "Rodada de abertura",
  replyRound: (n) => `Réplica ${n}`,
  judgeRound: "Veredito do juiz",
  starting: "Iniciando painel",
  verdictEyebrow: "Veredito do juiz",
  saveDiscussion: "Salvar discussão",
  footer:
    "Não substitui validação de mercado. O útil são as hipóteses frágeis — teste com humanos na semana.",
  errNeedKey: "Salve a API key antes.",
  errNeedFields: "Ideia e diretrizes são obrigatórias.",
  errRefine: "Falha ao refinar",
  errPanel: "Erro no painel",
  noVerdict: "(sem veredito)",
  roleShort: {
    advocate: "Defesa",
    prosecutor: "Ataque",
    skeptic: "Demanda",
  },
  roleName: {
    advocate: "Advogado",
    prosecutor: "Promotor",
    skeptic: "Cético de Mercado",
  },
  exportTitle: "PAINEL DE VALIDAÇÃO DE PROJETOS",
  exportIdea: "## IDEIA",
  exportGuidelines: "## DIRETRIZES",
  exportDebate: "## DEBATE",
  exportOpening: "RODADA DE ABERTURA",
  exportReply: (n) => `RODADA DE RÉPLICA ${n}`,
  exportVerdict: "VEREDITO DO JUIZ",
  exportDocTitle: "Painel de Validação de Projetos",
  exportVerdictLabel: "Veredito",
  language: "Idioma",
  defaultIdea: `O quê: [produto/serviço em 1–2 frases — o que entrega, para quem, como]
Formato: [SaaS / marketplace / serviço / conteúdo / físico / outro]
Problema: [dor concreta que alguém paga para resolver]
Solução: [como você resolve, sem floreio técnico]
Quem paga: [persona + contexto de compra]
Como monetiza: [assinatura / one-shot / % / freemium / outro — preço aproximado se souber]`,
  defaultGuidelines: `ICP: [quem compra de verdade — cargo, tamanho, orçamento, gatilho de compra]
Status quo: [o que essa pessoa faz hoje sem você — planilha, concorrente, nada]
Concorrência: [alternativas diretas e indiretas + preço aproximado]
Tese: [por que alguém trocaria o status quo por você — 1 frase]
Vantagem injusta: [canal, expertise, audiência, custo, distribuição — ou "nenhuma ainda"]
Restrição de validação: validar em 7 dias sem construir o produto; só conversas, pré-venda ou experimento barato.
Risco crítico: [a premissa que, se falsa, mata a ideia]
Fora de escopo: [o que você NÃO vai fazer nesta fase]
Orçamento / tempo disponível: [ex.: 5–10h/semana, R$0 de ads]`,
};

export const messages: Record<Locale, Messages> = { en, pt };

export function isLocale(v: string | null): v is Locale {
  return v === "en" || v === "pt";
}

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}
