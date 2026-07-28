"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TranscriptEntry } from "@/lib/panel";
import { extractVerdictLabel } from "@/lib/panel";

const ROLE_META: Record<
  string,
  { accent: string; short: string }
> = {
  Advogado: { accent: "advocate", short: "Defesa" },
  Promotor: { accent: "prosecutor", short: "Ataque" },
  "Cético de Mercado": { accent: "skeptic", short: "Demanda" },
};

type DebateProps = {
  transcript: TranscriptEntry[];
  currentRound: string | null;
  running: boolean;
};

export function DebateView({ transcript, currentRound, running }: DebateProps) {
  if (!transcript.length && !running) return null;

  let lastRound = "";
  const blocks: ReactNode[] = [];

  for (const entry of transcript) {
    const roundLabel =
      entry.round === "abertura"
        ? "Rodada de abertura"
        : `Réplica ${entry.round.replace("replica-", "")}`;

    if (roundLabel !== lastRound) {
      lastRound = roundLabel;
      blocks.push(
        <div key={`r-${entry.round}`} className="round-marker">
          <span>{roundLabel}</span>
        </div>,
      );
    }

    const meta = ROLE_META[entry.role] ?? { accent: "advocate", short: "" };
    blocks.push(
      <article key={`${entry.round}-${entry.role}`} className={`speech speech-${meta.accent}`}>
        <header>
          <h3>{entry.role}</h3>
          <span className="speech-tag">{meta.short}</span>
        </header>
        <div className="speech-body md">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.text}</ReactMarkdown>
        </div>
      </article>,
    );
  }

  return (
    <section className="debate" aria-live="polite">
      <h2 className="section-title">Discussão</h2>
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
};

export function VerdictView({ verdict }: VerdictProps) {
  if (!verdict) return null;
  const label = extractVerdictLabel(verdict);
  const body = verdict.replace(/^##\s*Veredito:\s*(GO|NO-GO|PIVOT)\s*/i, "").trim();

  return (
    <section className={`verdict-block verdict-${(label ?? "unknown").toLowerCase()}`}>
      <div className="verdict-banner">
        <p className="verdict-eyebrow">Veredito do juiz</p>
        <p className="verdict-label">{label ?? "—"}</p>
      </div>
      <div className="verdict-body md">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
      </div>
    </section>
  );
}
