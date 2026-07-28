# Painel de Validação de Projetos

Painel adversarial com LLMs para estressar uma ideia de negócio **antes** de construir. Três papéis debatem; um juiz emite veredito GO / NO-GO / PIVOT e um plano de validação de 7 dias.

**Isto não substitui validação de mercado.** O output útil é a lista de hipóteses frágeis para você testar com humanos de verdade.

## App web (recomendado)

Next.js dockerizado: API key no `localStorage`, ideia/diretrizes editáveis (com defaults), refine via IA, discussão ao vivo, veredito destacado, export `.txt` / `.doc`.

### Docker

```bash
docker compose up --build
```

Abre http://localhost:3001

### Dev local

```bash
cd webapp
npm install
npm run dev
```

1. Cola a Anthropic API key → Salvar (fica no browser).
2. Ajusta ideia + diretrizes (ou **Refinar com IA**).
3. **Rodar discussão** — abertura → réplicas → juiz.
4. Exporta `.txt` ou `.doc`.

A key sobe só no header `x-api-key` das rotas `/api/panel` e `/api/refine`. Não precisa de `.env` no servidor.

## Script Python (CLI)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install anthropic python-dotenv
export ANTHROPIC_API_KEY=sua-chave
# edite IDEIA/DIRETRIZES no fim de plano_validacao.py
python plano_validacao.py
```

## Como funciona

```
IDEIA + DIRETRIZES
        │
        ▼
┌───────────────────────┐
│  Rodada de abertura   │  Haiku — Advogado, Promotor, Cético
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Rodada(s) de réplica │  cada um ataca os outros
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│  Juiz (Opus)          │  GO / NO-GO / PIVOT + plano 7 dias
└───────────────────────┘
```

| Peça | Modelo default |
|---|---|
| Debatedores / refine | `claude-haiku-4-5-20251001` |
| Juiz | `claude-opus-4-8` |
| Réplicas | 0–2 (default 1) |
