export type VerdictLabel =
  | "GO"
  | "NO-GO"
  | "PIVOT"
  | "INDETERMINADO"
  | "INDETERMINATE";

const LABELS = "GO|NO-GO|PIVOT|INDETERMINADO|INDETERMINATE";
// Brackets are optional: the judge sometimes echoes the "[GO / NO-GO / ...]"
// template literally, and a longer option list makes that more likely.
const HEADER = `(?:Verdict|Veredito):\\s*\\[?\\s*(${LABELS})\\s*\\]?`;

export function extractVerdictLabel(verdict: string): VerdictLabel | null {
  const m = verdict.match(new RegExp(HEADER, "i"));
  if (!m) return null;
  return m[1].toUpperCase() as VerdictLabel;
}

/** Removes the "## Verdict: X" header so it isn't rendered twice. */
export function stripVerdictHeader(verdict: string): string {
  return verdict.replace(new RegExp(`^##\\s*${HEADER}\\s*`, "i"), "").trim();
}

/** CSS modifier: verdict-go, verdict-no-go, verdict-pivot, verdict-indeterminate. */
export function verdictSlug(label: VerdictLabel | null): string {
  if (!label) return "unknown";
  if (label.startsWith("INDETERMINA")) return "indeterminate";
  return label.toLowerCase();
}
