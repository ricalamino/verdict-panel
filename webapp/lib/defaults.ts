export const DEFAULT_IDEA = `O quê: [produto/serviço em 1–2 frases — o que entrega, para quem, como]
Formato: [SaaS / marketplace / serviço / conteúdo / físico / outro]
Problema: [dor concreta que alguém paga para resolver]
Solução: [como você resolve, sem floreio técnico]
Quem paga: [persona + contexto de compra]
Como monetiza: [assinatura / one-shot / % / freemium / outro — e preço aproximado se souber]`;

export const DEFAULT_GUIDELINES = `ICP: [quem compra de verdade — cargo, tamanho, orçamento, gatilho de compra]
Status quo: [o que essa pessoa faz hoje sem você — planilha, concorrente, nada]
Concorrência: [alternativas diretas e indiretas + preço aproximado]
Tese: [por que alguém trocaria o status quo por você — 1 frase]
Diferencial / vantagem injusta: [canal, expertise, audiência, custo, distribuição — ou "nenhuma ainda"]
Restrição de validação: validar em 7 dias sem construir o produto; só conversas, pré-venda ou experimento barato.
Risco crítico: [a premissa que, se falsa, mata a ideia]
Fora de escopo: [o que você NÃO vai fazer nesta fase]
Orçamento / tempo disponível: [ex.: 5–10h/semana, R$0 de ads]`;

export const STORAGE_KEY = "painel_anthropic_api_key";

export const PANEL_MODEL = "claude-haiku-4-5-20251001";
export const JUDGE_MODEL = "claude-opus-4-8";
export const REFINE_MODEL = "claude-haiku-4-5-20251001";
export const REPLY_ROUNDS = 1;
export const MAX_TOKENS_PANEL = 700;
export const MAX_TOKENS_JUDGE = 1500;
export const MAX_TOKENS_REFINE = 1200;
