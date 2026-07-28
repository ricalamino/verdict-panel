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

export type Role = "Advogado" | "Promotor" | "Cético de Mercado";

export type TranscriptEntry = {
  role: Role;
  text: string;
  round: "abertura" | `replica-${number}`;
};

export const ROLES: Record<Role, string> = {
  Advogado:
    "Você é o Advogado da ideia. Construa o melhor caso possível para " +
    "CONSTRUIR este projeto: quem paga, por que pagaria, qual o caminho " +
    "mais curto para receita, qual vantagem injusta o autor tem. " +
    "Seja específico e comercial, não otimista vazio. Sem floreio técnico. " +
    "Máximo 6 bullets curtos.",
  Promotor:
    "Você é o Promotor. Seu trabalho é MATAR a ideia. Por que ninguém vai " +
    "pagar? Onde o mercado já está saturado ou resolvido de graça? Qual o " +
    "custo de aquisição que inviabiliza? Que suposição frágil derruba tudo? " +
    "Seja brutal e concreto. 'Isso não vende' é resposta válida se justificada. " +
    "Máximo 6 bullets curtos.",
  "Cético de Mercado":
    "Você é o Cético de Mercado. Foque em UM ponto: onde o sinal de demanda " +
    "é falso. Distinga interesse declarado de comportamento de pagamento. " +
    "Aponte onde o autor pode estar confundindo 'acho legal' com 'vou pagar'. " +
    "Aponte o experimento mais barato que provaria ou refutaria a demanda real. " +
    "Máximo 6 bullets curtos.",
};

export const JUDGE_PROMPT = `Você é um Conselheiro de Projetos e Monetização brutalmente pragmático.
Seu único norte é dinheiro e tração real. Não elogia tecnologia, não suaviza, não
aceita "vamos ver no que dá".

Você acabou de ler um debate entre um Advogado, um Promotor e um Cético de Mercado
sobre a ideia abaixo. Pese os argumentos e emita o veredito FINAL.

Princípios:
- Tração > Tecnologia
- Validação rápida ou morte (se não dá pra validar em 7 dias, é grande demais)
- Receita é a única métrica que importa (likes e "interesse" não pagam conta)

Retorne EXATAMENTE neste formato:

## Veredito: [GO / NO-GO / PIVOT]

### Por quê
[1 parágrafo direto]

### As 3 hipóteses mais frágeis (teste estas com HUMANOS, não com IA)
1. ...
2. ...
3. ...

### Plano de Validação (7 dias)
- Dia 1: ...
- Dia 2: ...
- Dia 3: ...
- Dia 4: ...
- Dia 5: ...
- Dia 6: ...
- Dia 7: ...

### Próximos passos imediatos
1. ...
2. ...
3. ...

Se NO-GO: explique em 2 frases por que morre. Não console, não suavize.`;

const REFINE_PROMPT = `Você é um editor brutal de pitches de negócio.
Recebe uma IDEIA e DIRETRIZES de validação. Retorne versões refinadas, mais
nítidas e testáveis — sem inventar fatos que não estavam no input.

Regras:
- Preserve a intenção do autor
- Torne ICP, tese, preço, risco crítico e concorrência explícitos
- Corte floreio; prefira concreto
- Se faltar algo crítico, marque como "[a preencher: ...]"

Retorne EXATAMENTE neste formato (sem markdown extra fora dos blocos):

## IDEIA
[texto refinado]

## DIRETRIZES
[texto refinado]`;

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

function contextBlock(idea: string, guidelines: string) {
  return `## IDEIA\n${idea}\n\n## DIRETRIZES E CONTEXTO\n${guidelines}`;
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
): AsyncGenerator<PanelEvent> {
  const client = createClient(apiKey);
  const context = contextBlock(idea, guidelines);
  const transcript: TranscriptEntry[] = [];

  yield { type: "round", name: "Rodada de abertura" };

  for (const role of Object.keys(ROLES) as Role[]) {
    const text = await callModel(
      client,
      PANEL_MODEL,
      ROLES[role],
      `${context}\n\nApresente sua posição de abertura.`,
      MAX_TOKENS_PANEL,
    );
    const entry: TranscriptEntry = { role, text, round: "abertura" };
    transcript.push(entry);
    yield { type: "speech", entry };
  }

  for (let r = 1; r <= replyRounds; r++) {
    yield { type: "round", name: `Rodada de réplica ${r}` };
    const debateSoFar = transcript
      .map((e) => `### ${e.role}\n${e.text}`)
      .join("\n\n");
    const newRound: TranscriptEntry[] = [];

    for (const role of Object.keys(ROLES) as Role[]) {
      const text = await callModel(
        client,
        PANEL_MODEL,
        ROLES[role],
        `${context}\n\n## DEBATE ATÉ AGORA\n${debateSoFar}\n\n` +
          `Responda aos outros. Ataque os pontos fracos dos argumentos ` +
          `deles e fortaleça o seu. Não repita o que já disse.`,
        MAX_TOKENS_PANEL,
      );
      const entry: TranscriptEntry = {
        role,
        text,
        round: `replica-${r}`,
      };
      newRound.push(entry);
      yield { type: "speech", entry };
    }
    transcript.push(...newRound);
  }

  yield { type: "round", name: "Veredito do juiz" };

  const debate = transcript
    .map((e) => `### ${e.role}\n${e.text}`)
    .join("\n\n");
  const verdict = await callModel(
    client,
    JUDGE_MODEL,
    JUDGE_PROMPT,
    `${context}\n\n## DEBATE COMPLETO\n${debate}\n\nEmita o veredito final.`,
    MAX_TOKENS_JUDGE,
  );

  yield { type: "verdict", text: verdict };
  yield { type: "done" };
}

export async function refineIdea(
  apiKey: string,
  idea: string,
  guidelines: string,
): Promise<{ idea: string; guidelines: string }> {
  const client = createClient(apiKey);
  const raw = await callModel(
    client,
    REFINE_MODEL,
    REFINE_PROMPT,
    contextBlock(idea, guidelines),
    MAX_TOKENS_REFINE,
  );

  const ideaMatch = raw.match(/## IDEIA\s*\n([\s\S]*?)(?=\n## DIRETRIZES|$)/i);
  const guidelinesMatch = raw.match(/## DIRETRIZES\s*\n([\s\S]*)$/i);

  return {
    idea: ideaMatch?.[1]?.trim() || idea,
    guidelines: guidelinesMatch?.[1]?.trim() || guidelines,
  };
}

export function extractVerdictLabel(verdict: string): "GO" | "NO-GO" | "PIVOT" | null {
  const m = verdict.match(/Veredito:\s*(GO|NO-GO|PIVOT)/i);
  if (!m) return null;
  const v = m[1].toUpperCase();
  if (v === "GO" || v === "NO-GO" || v === "PIVOT") return v;
  return null;
}
