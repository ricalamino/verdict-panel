"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Messages } from "@/lib/i18n";
import type { TranscriptEntry } from "@/lib/panel";
import type { Briefing, ResearchAudit } from "@/lib/research";
import {
  extractVerdictLabel,
  stripVerdictHeader,
  verdictSlug,
} from "@/lib/verdict";

const ACCENT: Record<string, string> = {
  advocate: "advocate",
  prosecutor: "prosecutor",
  skeptic: "skeptic",
};

type BriefingProps = {
  briefing: Briefing | null;
  audit: ResearchAudit | null;
  t: Messages;
};

export function BriefingView({ briefing, audit, t }: BriefingProps) {
  if (!briefing) return null;

  const gaps = Array.isArray(briefing.lacunas)
    ? (briefing.lacunas as unknown[]).filter(
        (g): g is string => typeof g === "string" && g.trim().length > 0,
      )
    : [];
  const blocking = Array.isArray(briefing.lacunas_bloqueantes)
    ? briefing.lacunas_bloqueantes.filter(
        (g): g is string => typeof g === "string" && g.trim().length > 0,
      )
    : [];
  const alerts = Array.isArray(briefing.alertas)
    ? briefing.alertas.filter(
        (g): g is string => typeof g === "string" && g.trim().length > 0,
      )
    : [];
  const execucao =
    briefing.execucao && typeof briefing.execucao === "object"
      ? Object.entries(briefing.execucao)
      : [];

  return (
    <section className="briefing">
      <div className="briefing-head">
        <h2 className="section-title">{t.briefingTitle}</h2>
        {audit && (
          <span className="briefing-meta">
            {t.briefingSearches(String(audit.searches))} ·{" "}
            {t.briefingTokens(
              formatTokens(audit.usage.inputTokens + audit.usage.outputTokens),
            )}
            {audit.searchHits != null && <> · {audit.searchHits} hits</>}
            {!!audit.excusesScrubbed?.length && (
              <> · {audit.excusesScrubbed.length} desculpa(s) técnica(s) scrubbed</>
            )}
          </span>
        )}
      </div>

      {alerts.length > 0 && (
        <>
          <h3 className="briefing-sub briefing-sub-alert">{t.briefingAlerts}</h3>
          <ul className="gap-list gap-list-alert">
            {alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </>
      )}

      {briefing.fatos.length === 0 && !(briefing.fatos_vf?.length) ? (
        <p className="briefing-empty">{t.briefingNoFacts}</p>
      ) : (
        <>
          {!!briefing.fatos_vf?.length && (
            <>
              <h3 className="briefing-sub briefing-sub-vf">{t.briefingFirstHand}</h3>
              <ul className="fact-list">
                {briefing.fatos_vf.map((f) => (
                  <li key={f.id} className={f.soft ? "fact-soft" : undefined}>
                    <span
                      className={`fact-id${f.soft ? " fact-id-soft" : " fact-id-vf"}`}
                    >
                      [{f.id}]
                    </span>
                    {f.vf ? (
                      <ul className="vf-fields">
                        {(
                          [
                            "valor_mensal",
                            "n_clientes",
                            "o_que_exatamente_esta_sendo_cobrado",
                            "isolado_ou_pacote",
                            "meses_de_retencao",
                          ] as const
                        ).map((k) => {
                          const v = f.vf?.[k]?.trim();
                          return (
                            <li
                              key={k}
                              className={!v ? "vf-field-missing" : undefined}
                            >
                              <span className="vf-key">{t.vfFieldLabels[k]}:</span>{" "}
                              {v || "(missing)"}
                            </li>
                          );
                        })}
                        {f.soft && (
                          <li className="vf-field-missing">
                            soft [F-VF?] — weighs as [P]; do not infer missing fields
                          </li>
                        )}
                      </ul>
                    ) : (
                      <span className="fact-claim"> {f.afirmacao}</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          {briefing.fatos.length > 0 && (
            <>
              <h3 className="briefing-sub">{t.briefingFacts}</h3>
              <ul className="fact-list">
                {briefing.fatos.map((f) => (
                  <li key={f.id} className={f.soft ? "fact-soft" : undefined}>
                    <span className={`fact-id${f.soft ? " fact-id-soft" : ""}`}>
                      [{f.id}]
                    </span>{" "}
                    <span className="fact-claim">{f.afirmacao}</span>
                    {f.fonte && (
                      <>
                        {" "}
                        <FactSource href={f.fonte} />
                      </>
                    )}
                    <span
                      className={`fact-date${f.soft || !f.data ? " fact-date-missing" : ""}`}
                    >
                      {" "}
                      · data: {f.data || "(ausente)"}
                      {f.soft ? " · soft [F?]" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {blocking.length > 0 && (
        <>
          <h3 className="briefing-sub briefing-sub-blocking">
            {t.briefingBlockingGaps}
          </h3>
          <ul className="gap-list gap-list-blocking">
            {blocking.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </>
      )}

      {gaps.length > 0 && (
        <>
          <h3 className="briefing-sub">{t.briefingGaps}</h3>
          <ul className="gap-list">
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </>
      )}

      {execucao.length > 0 && (
        <>
          <h3 className="briefing-sub">{t.briefingExecution}</h3>
          <ul className="exec-list">
            {execucao.map(([axis, terms]) => (
              <li key={axis} className={!terms.length ? "exec-empty" : undefined}>
                <span className="exec-axis">{axis}</span>
                {terms.length ? (
                  <span className="exec-terms"> — {terms.join("; ")}</span>
                ) : (
                  <span className="exec-terms"> — ∅</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function FactSource({ href }: { href: string }) {
  if (!/^https?:\/\//i.test(href)) {
    return <span className="fact-source">— {href}</span>;
  }
  let label = href;
  try {
    label = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    // keep the raw string
  }
  return (
    <a
      className="fact-source"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      — {label}
    </a>
  );
}

type DebateProps = {
  transcript: TranscriptEntry[];
  currentRound: string | null;
  running: boolean;
  t: Messages;
};

export function DebateView({
  transcript,
  currentRound,
  running,
  t,
}: DebateProps) {
  if (!transcript.length && !running) return null;

  let lastRound = "";
  const blocks: ReactNode[] = [];

  for (const entry of transcript) {
    const roundLabel =
      entry.round === "opening"
        ? t.openingRound
        : t.replyRound(entry.round.replace("reply-", ""));

    if (roundLabel !== lastRound) {
      lastRound = roundLabel;
      blocks.push(
        <div key={`r-${entry.round}`} className="round-marker">
          <span>{roundLabel}</span>
        </div>,
      );
    }

    const accent = ACCENT[entry.role] ?? "advocate";
    blocks.push(
      <article
        key={`${entry.round}-${entry.role}`}
        className={`speech speech-${accent}`}
      >
        <header>
          <h3>{entry.roleLabel}</h3>
          <span className="speech-tag">{t.roleShort[entry.role]}</span>
        </header>
        <div className="speech-body md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.text}</ReactMarkdown>
        </div>
      </article>,
    );
  }

  return (
    <section className="debate" aria-live="polite">
      <h2 className="section-title">{t.discussion}</h2>
      {blocks}
      {running && currentRound && (
        <div className="thinking" role="status">
          <span className="pulse" />
          {currentRound}…
          {currentRound === t.researchRound && (
            <span className="thinking-hint">{t.researchHint}</span>
          )}
        </div>
      )}
    </section>
  );
}

type VerdictProps = {
  verdict: string | null;
  t: Messages;
};

export function VerdictView({ verdict, t }: VerdictProps) {
  if (!verdict) return null;
  const label = extractVerdictLabel(verdict);
  const body = stripVerdictHeader(verdict);

  return (
    <section className={`verdict-block verdict-${verdictSlug(label)}`}>
      <div className="verdict-banner">
        <p className="verdict-eyebrow">{t.verdictEyebrow}</p>
        <p className="verdict-label">{label ?? "—"}</p>
      </div>
      <div className="verdict-body md">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </section>
  );
}
