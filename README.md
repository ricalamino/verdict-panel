# Project Validation Panel

An adversarial LLM panel that stress-tests a business idea **before** you build it. Three roles debate; a judge issues a GO / NO-GO / PIVOT verdict plus a 7-day validation plan.

**This does not replace market validation.** The useful output is the list of fragile hypotheses for you to test with real humans.

## Web app (recommended)

Dockerized Next.js: API key in `localStorage`, editable idea/guidelines (with defaults), AI-assisted refine, live discussion, highlighted verdict, `.txt` / `.doc` export.

### Docker

```bash
docker compose up --build
```

Opens http://localhost:3555

### Local dev

```bash
cd webapp
npm install
npm run dev
```

1. Paste your Anthropic API key → Save (stays in the browser).
2. Adjust idea + guidelines (or hit **Refine with AI**). Default language: English; the selector at the top switches to Portuguese (UI + prompts).
3. **Run discussion** — opening → replies → judge.
4. Export `.txt` or `.doc`.

The key is only sent in the `x-api-key` header of the `/api/panel` and `/api/refine` routes. No server-side `.env` needed.

## Python script (CLI)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install anthropic python-dotenv
export ANTHROPIC_API_KEY=your-key
# edit IDEA/GUIDELINES at the bottom of validation_panel.py
python validation_panel.py
```

## How it works

```
IDEA + GUIDELINES
        │
        ▼
┌───────────────────────┐
│    Opening round      │  Haiku — Advocate, Prosecutor, Skeptic
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│    Reply round(s)     │  each one attacks the others
└───────────────────────┘
        │
        ▼
┌───────────────────────┐
│    Judge (Opus)       │  GO / NO-GO / PIVOT + 7-day plan
└───────────────────────┘
```

| Piece | Default model |
|---|---|
| Debaters / refine | `claude-haiku-4-5-20251001` |
| Judge | `claude-opus-4-8` |
| Replies | 0–2 (default 1) |
