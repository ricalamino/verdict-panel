import type { Messages } from "@/lib/i18n";
import type { TranscriptEntry } from "@/lib/panel";
import { extractVerdictLabel } from "@/lib/panel";

export function buildExportText(opts: {
  idea: string;
  guidelines: string;
  transcript: TranscriptEntry[];
  verdict: string;
  t: Messages;
}): string {
  const { idea, guidelines, transcript, verdict, t } = opts;
  const lines: string[] = [
    t.exportTitle,
    "=".repeat(60),
    "",
    t.exportIdea,
    idea.trim(),
    "",
    t.exportGuidelines,
    guidelines.trim(),
    "",
    t.exportDebate,
    "",
  ];

  let currentRound = "";
  for (const entry of transcript) {
    const roundLabel =
      entry.round === "opening"
        ? t.exportOpening
        : t.exportReply(entry.round.replace("reply-", ""));
    if (roundLabel !== currentRound) {
      currentRound = roundLabel;
      lines.push("-".repeat(60), roundLabel, "-".repeat(60), "");
    }
    lines.push(`--- ${entry.roleLabel} ---`, entry.text, "");
  }

  lines.push("=".repeat(60), t.exportVerdict, "=".repeat(60), "", verdict, "");
  return lines.join("\n");
}

export function downloadTxt(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, filename);
}

export function downloadDoc(
  filename: string,
  content: string,
  verdict: string,
  t: Messages,
) {
  const label = extractVerdictLabel(verdict) ?? "";
  const escaped = escapeHtml(content).replace(/\n/g, "<br/>");
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(t.exportDocTitle)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.45; color: #1a1a1a; }
  h1 { font-size: 18pt; }
  .verdict { background: #f0f0f0; padding: 12pt; border-left: 4pt solid #111; margin: 12pt 0; }
  .label { font-weight: bold; font-size: 14pt; }
</style>
</head>
<body>
  <h1>${escapeHtml(t.exportDocTitle)}</h1>
  ${label ? `<div class="verdict"><span class="label">${escapeHtml(t.exportVerdictLabel)}: ${label}</span></div>` : ""}
  <div>${escaped}</div>
</body>
</html>`;
  const blob = new Blob(["\ufeff", html], {
    type: "application/msword;charset=utf-8",
  });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
