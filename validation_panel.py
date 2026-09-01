#!/usr/bin/env python3
"""
validation_panel.py
-------------------
Adversarial project validation panel.

An Advocate, a Prosecutor, and a Market Skeptic debate the idea in structured
rounds. A Judge (strong model) reads the debate and issues a GO/NO-GO/PIVOT
verdict in the monetization-advisor format.

IMPORTANT: this does NOT replace market validation. The output is a list of the
most fragile hypotheses for you to test with real humans this week.

Usage:
    export ANTHROPIC_API_KEY="your-key"
    # Identity-linked (personal/service-account) keys that aren't scoped to a
    # single workspace also need:
    export ANTHROPIC_WORKSPACE_ID="wrkspc_..."
    pip install anthropic
    python validation_panel.py

Or edit IDEA and GUIDELINES at the bottom of the file and run it directly.
"""
from dotenv import load_dotenv
load_dotenv()  # at the top, before Anthropic()
import os
import sys
from anthropic import Anthropic

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PANEL_MODEL = "claude-haiku-4-5-20251001"  # cheap, for the debaters
JUDGE_MODEL = "claude-opus-4-8"            # strong, only for the final verdict
REPLY_ROUNDS = 1                           # nr. of reply rounds (0-2 is the useful range)
MAX_TOKENS_PANEL = 700
MAX_TOKENS_JUDGE = 1500

_workspace_id = os.environ.get("ANTHROPIC_WORKSPACE_ID", "").strip()
client = Anthropic(
    **(
        {"default_headers": {"anthropic-workspace-id": _workspace_id}}
        if _workspace_id
        else {}
    )
)  # reads ANTHROPIC_API_KEY from the environment


# ---------------------------------------------------------------------------
# Panel roles
# ---------------------------------------------------------------------------

ROLES = {
    "Advocate": (
        "You are the Advocate for this idea. Build the strongest possible case "
        "to BUILD this project: who pays, why they would pay, the shortest path "
        "to revenue, what unfair advantage the author has. "
        "Be specific and commercial, not empty optimism. No technical fluff. "
        "Max 6 short bullets."
    ),
    "Prosecutor": (
        "You are the Prosecutor. Your job is to KILL the idea. Why will nobody "
        "pay? Where is the market already saturated or solved for free? What "
        "acquisition cost makes it unviable? Which fragile assumption collapses "
        "everything? Be brutal and concrete. 'This won't sell' is a valid answer "
        "if justified. Max 6 short bullets."
    ),
    "Market Skeptic": (
        "You are the Market Skeptic. Focus on ONE point: where the demand signal "
        "is fake. Distinguish stated interest from paying behavior. "
        "Point out where the author may be confusing 'sounds cool' with 'I'll pay'. "
        "Name the cheapest experiment that would prove or disprove real demand. "
        "Max 6 short bullets."
    ),
}


# ---------------------------------------------------------------------------
# Judge — mirrors the monetization-advisor format
# ---------------------------------------------------------------------------

JUDGE_PROMPT = """You are a brutally pragmatic Project & Monetization Advisor.
Your only north star is real money and traction. Do not praise technology, do not
soften, do not accept "let's see what happens".

You just read a debate between an Advocate, a Prosecutor, and a Market Skeptic
about the idea below. Weigh the arguments and issue the FINAL verdict.

Principles:
- Traction > Technology
- Fast validation or death (if it can't be validated in 7 days, it's too big)
- Revenue is the only metric that matters (likes and "interest" don't pay bills)

Return EXACTLY in this format:

## Verdict: [GO / NO-GO / PIVOT]

### Why
[1 direct paragraph]

### The 3 most fragile hypotheses (test these with HUMANS, not AI)
1. ...
2. ...
3. ...

### Validation Plan (7 days)
- Day 1: ...
- Day 2: ...
- Day 3: ...
- Day 4: ...
- Day 5: ...
- Day 6: ...
- Day 7: ...

### Immediate next steps
1. ...
2. ...
3. ...

If NO-GO: explain in 2 sentences why it dies. Do not console, do not soften."""


# ---------------------------------------------------------------------------
# Functions
# ---------------------------------------------------------------------------

def call(model, system, user_message, max_tokens):
    """Simple call to the messages endpoint."""
    try:
        resp = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_message}],
        )
    except Exception as e:
        if "anthropic-workspace-id is required" in str(e):
            sys.exit(
                "Identity-linked API key: set ANTHROPIC_WORKSPACE_ID=wrkspc_... "
                "(Console → Settings → Workspaces → ID) or create a "
                "workspace-scoped key."
            )
        raise
    return "".join(b.text for b in resp.content if b.type == "text").strip()


def context_block(idea, guidelines):
    return f"## IDEA\n{idea}\n\n## GUIDELINES & CONTEXT\n{guidelines}"


def run_panel(idea, guidelines):
    context = context_block(idea, guidelines)
    transcript = []  # list of (role, text)

    # Opening round: each role states its position on the idea
    print("=" * 70)
    print("OPENING ROUND")
    print("=" * 70)
    for role, system in ROLES.items():
        msg = f"{context}\n\nPresent your opening position."
        text = call(PANEL_MODEL, system, msg, MAX_TOKENS_PANEL)
        transcript.append((role, text))
        print(f"\n--- {role} ---\n{text}\n")

    # Reply rounds: each role responds to what the others said
    for r in range(1, REPLY_ROUNDS + 1):
        print("=" * 70)
        print(f"REPLY ROUND {r}")
        print("=" * 70)
        debate_so_far = "\n\n".join(
            f"### {role}\n{text}" for role, text in transcript
        )
        new_round = []
        for role, system in ROLES.items():
            msg = (
                f"{context}\n\n## DEBATE SO FAR\n{debate_so_far}\n\n"
                f"Respond to the others. Attack the weak points in their arguments "
                f"and strengthen yours. Do not repeat what you already said."
            )
            text = call(PANEL_MODEL, system, msg, MAX_TOKENS_PANEL)
            new_round.append((role, text))
            print(f"\n--- {role} (reply {r}) ---\n{text}\n")
        transcript.extend(new_round)

    return transcript


def run_judge(idea, guidelines, transcript):
    context = context_block(idea, guidelines)
    debate = "\n\n".join(f"### {role}\n{text}" for role, text in transcript)
    msg = f"{context}\n\n## FULL DEBATE\n{debate}\n\nIssue the final verdict."
    return call(JUDGE_MODEL, JUDGE_PROMPT, msg, MAX_TOKENS_JUDGE)


def validate(idea, guidelines):
    transcript = run_panel(idea, guidelines)
    print("=" * 70)
    print("JUDGE VERDICT")
    print("=" * 70)
    verdict = run_judge(idea, guidelines, transcript)
    print("\n" + verdict + "\n")
    return verdict


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Set ANTHROPIC_API_KEY in the environment before running.")

    # --- Example: WhatsApp notification API for devs ---
    IDEA = """
    Micro-SaaS: notification API on top of the WhatsApp Cloud API (official, from
    Meta) for developers. Single endpoint POST /notify (token + message) — no
    chatbot, no CRM, no shared inbox, no inbound messages. Use case: system alerts
    (deploy, monitoring, betting pool, order shipped, appointment booked).
    """
    GUIDELINES = """
    ICP: individual developers and small technical teams who today use unofficial
    solutions (CallMeBot, free) or paid competitors (Whapi.Cloud US$29/mo, WAAPI
    US$10/mo, UltraMsg US$39/mo, Zernio).
    Constraint: validate in 7 days by testing the competitors directly + outreach
    to real devs, without writing any product code first.
    Thesis: there is margin between Meta's real cost (~US$0.007/message via
    template) and what a dev would pay to avoid dealing with business
    verification, template approval, and Cloud API onboarding.
    Critical risk to resolve before any sale: find out whether a generic template
    like "Alert: {{1}}" gets approved by Meta for any kind of content (deploy,
    server, order, appointment). If it does, the "5-minute integration" promise
    holds. If Meta requires one template per notification type, the MVP does not
    scale and the pitch breaks.
    Direct competition: CallMeBot covers the same use case for free (unofficial,
    through a personal number). The differentiator would have to be
    reliability/officialness, not price.
    Revenue model: freemium — free plan with a few messages/month, paid plan by
    volume (e.g. US$0.02-0.03/message, margin over Meta's US$0.007 cost).
    Unfair advantage: none identified yet — no prior sale in this specific niche.
    """

    validate(IDEA, GUIDELINES)
