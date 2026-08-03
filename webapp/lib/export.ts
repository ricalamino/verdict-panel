import type { Messages } from "@/lib/i18n";
import type { TranscriptEntry } from "@/lib/panel";
import type { Briefing, ResearchAudit } from "@/lib/research";
import { extractVerdictLabel } from "@/lib/verdict";

export function buildExportText(opts: {
  idea: string;
  guidelines: string;
  briefing: Briefing | null;
  audit: ResearchAudit | null;
  transcript: TranscriptEntry[];
  verdict: string;
  t: Messages;
}): string {
  const { idea, guidelines, briefing, audit, transcript, verdict, t } = opts;
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
    t.exportBriefing,
  ];

  if (!briefing) {
    lines.push(t.exportNoBriefing, "");
  } else {
    if (audit) lines.push(t.briefingSearches(String(audit.searches)));
    const vf = briefing.fatos_vf ?? [];
    if (vf.length) {
      lines.push("", t.exportFirstHand);
      for (const f of vf) {
        if (f.vf) {
          lines.push(`[${f.id}]${f.soft ? " soft [F-VF?]" : ""}`);
          for (const k of [
            "valor_mensal",
            "n_clientes",
            "o_que_exatamente_esta_sendo_cobrado",
            "isolado_ou_pacote",
            "meses_de_retencao",
          ] as const) {
            lines.push(
              `  ${t.vfFieldLabels[k]}: ${f.vf[k]?.trim() || "(missing)"}`,
            );
          }
        } else {
          lines.push(`[${f.id}] ${f.afirmacao}`);
        }
      }
    }
    const alerts = Array.isArray(briefing.alertas)
      ? briefing.alertas.filter(
          (g): g is string => typeof g === "string" && g.trim().length > 0,
        )
      : [];
    if (alerts.length) {
      lines.push("", t.exportAlerts);
      for (const a of alerts) lines.push(`- ${a}`);
    }
    lines.push("", t.exportFacts);
    if (briefing.fatos.length === 0) {
      lines.push(t.briefingNoFacts);
    } else {
      for (const f of briefing.fatos) {
        const bits = [
          f.fonte ? `fonte: ${f.fonte}` : "",
          f.data ? `data: ${f.data}` : "data: (ausente)",
          f.soft ? "soft [F?]" : "",
        ].filter(Boolean);
        lines.push(`[${f.id}] ${f.afirmacao}${bits.length ? ` — ${bits.join(" · ")}` : ""}`);
      }
    }
    const blocking = Array.isArray(briefing.lacunas_bloqueantes)
      ? briefing.lacunas_bloqueantes.filter(
          (g): g is string => typeof g === "string" && g.trim().length > 0,
        )
      : [];
    if (blocking.length) {
      lines.push("", t.exportBlockingGaps);
      for (const g of blocking) lines.push(`- ${g}`);
    }
    const gaps = Array.isArray(briefing.lacunas)
      ? (briefing.lacunas as unknown[]).filter(
          (g): g is string => typeof g === "string" && g.trim().length > 0,
        )
      : [];
    if (gaps.length) {
      lines.push("", t.exportGaps);
      for (const g of gaps) lines.push(`- ${g}`);
    }
    const execucao =
      briefing.execucao && typeof briefing.execucao === "object"
        ? Object.entries(briefing.execucao)
        : [];
    if (execucao.length) {
      lines.push("", t.exportExecution);
      for (const [axis, terms] of execucao) {
        const list = Array.isArray(terms) ? terms.filter(Boolean) : [];
        lines.push(`- ${axis}: ${list.length ? list.join("; ") : "∅"}`);
      }
    }
    lines.push("");
  }

  lines.push(t.exportDebate, "");

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

/**
 * The audit artifact: parsed briefing plus the raw server_tool_use /
 * web_search_tool_result blocks the researcher produced.
 */
export function downloadBriefingJson(
  filename: string,
  payload: {
    idea: string;
    guidelines: string;
    briefing: Briefing | null;
    audit: ResearchAudit | null;
  },
) {
  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), ...payload },
    null,
    2,
  );
  const blob = new Blob([body], { type: "application/json;charset=utf-8" });
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
