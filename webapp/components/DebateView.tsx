"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Messages } from "@/lib/i18n";
import type { TranscriptEntry } from "@/lib/panel";
import { extractVerdictLabel } from "@/lib/panel";

const ACCENT: Record<string, string> = {
  advocate: "advocate",
  prosecutor: "prosecutor",
  skeptic: "skeptic",
};

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
  const body = verdict
    .replace(/^##\s*(?:Verdict|Veredito):\s*(GO|NO-GO|PIVOT)\s*/i, "")
    .trim();

  return (
    <section
      className={`verdict-block verdict-${(label ?? "unknown").toLowerCase()}`}
    >
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
