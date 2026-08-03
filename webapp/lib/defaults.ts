export const STORAGE_KEY = "panel_anthropic_api_key";

export const PANEL_MODEL = "claude-haiku-4-5-20251001";
export const JUDGE_MODEL = "claude-opus-4-8";
export const REFINE_MODEL = "claude-haiku-4-5-20251001";
// Researcher extracts and structures — Sonnet is enough. Opus stays on the Judge.
// Haiku 4.5 is cheaper but only has web_search_20250305 (no dynamic filtering).
export const RESEARCH_MODEL = "claude-sonnet-5";
/**
 * Per-axis effort. Three parallel axes × low keeps thinking cheap while each
 * axis still reaches for tools. Raise to "medium" only if an axis comes back empty.
 */
export const RESEARCH_EFFORT = "low";
export const REPLY_ROUNDS = 1;
export const MAX_TOKENS_PANEL = 900;
export const MAX_TOKENS_JUDGE = 1500;
export const MAX_TOKENS_REFINE = 1200;
/**
 * Per-axis output ceiling. Slim axis schemas; generous enough to avoid
 * truncation → paid parse-retry.
 */
export const MAX_TOKENS_RESEARCH = 6000;
/**
 * Soft cap PER AXIS. Three parallel axes with small contexts should each land
 * well under this; the old 100k blow-up was one call accumulating 3+ searches.
 */
export const RESEARCH_TOKEN_BUDGET = 50_000;
/**
 * Searches PER AXIS (not global). Three axes × 3 = up to 9 searches, but each
 * call stays small — cheaper than one call with 9 because cost is superlinear
 * inside a single server-side tool loop.
 */
export const RESEARCH_MAX_SEARCHES = 3;
/** How often we resume a single axis after pause_turn. */
export const RESEARCH_MAX_RESUMES = 1;
/** Max fatos kept after merging all axes (renumbered F1..Fn). */
export const RESEARCH_MAX_FACTS = 12;
