"use client";

import { useCallback, useRef, useState } from "react";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { DebateView, VerdictView } from "@/components/DebateView";
import { DEFAULT_GUIDELINES, DEFAULT_IDEA } from "@/lib/defaults";
import { buildExportText, downloadDoc, downloadTxt } from "@/lib/export";
import type { PanelEvent, TranscriptEntry } from "@/lib/panel";

export default function HomePage() {
  const [apiKey, setApiKey] = useState("");
  const [idea, setIdea] = useState(DEFAULT_IDEA);
  const [guidelines, setGuidelines] = useState(DEFAULT_GUIDELINES);
  const [replyRounds, setReplyRounds] = useState(1);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const onReady = useCallback((key: string) => setApiKey(key), []);

  async function refine() {
    if (!apiKey) {
      setError("Salve a API key antes.");
      return;
    }
    setRefining(true);
    setError(null);
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ idea, guidelines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao refinar");
      setIdea(data.idea);
      setGuidelines(data.guidelines);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no refine");
    } finally {
      setRefining(false);
    }
  }

  async function runPanel() {
    if (!apiKey) {
      setError("Salve a API key antes.");
      return;
    }
    if (!idea.trim() || !guidelines.trim()) {
      setError("Ideia e diretrizes são obrigatórias.");
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setRunning(true);
    setError(null);
    setTranscript([]);
    setVerdict(null);
    setCurrentRound("Iniciando painel");

    try {
      const res = await fetch("/api/panel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ idea, guidelines, replyRounds }),
        signal: ac.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6)) as PanelEvent;

          if (event.type === "round") setCurrentRound(event.name);
          if (event.type === "speech") {
            setTranscript((prev) => [...prev, event.entry]);
          }
          if (event.type === "verdict") {
            setVerdict(event.text);
            setCurrentRound(null);
          }
          if (event.type === "error") throw new Error(event.message);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Erro no painel");
    } finally {
      setRunning(false);
      setCurrentRound(null);
    }
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
    setCurrentRound(null);
  }

  function exportFile(format: "txt" | "doc") {
    if (!verdict && !transcript.length) return;
    const text = buildExportText({
      idea,
      guidelines,
      transcript,
      verdict: verdict ?? "(sem veredito)",
    });
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "txt") {
      downloadTxt(`painel-validacao-${stamp}.txt`, text);
    } else {
      downloadDoc(`painel-validacao-${stamp}.doc`, text, verdict ?? "");
    }
  }

  const canRun = Boolean(apiKey) && !running && !refining;

  return (
    <main className="page">
      <header className="hero">
        <p className="brand">Painel</p>
        <h1>Validação adversarial de projetos</h1>
        <p className="lede">
          Advogado, Promotor e Cético debatem. O juiz emite GO / NO-GO / PIVOT —
          hipóteses frágeis pra testar com humanos, não com outra IA.
        </p>
      </header>

      <ApiKeyGate onReady={onReady} />

      <section className="brief">
        <div className="field">
          <label htmlFor="idea">Ideia</label>
          <textarea
            id="idea"
            rows={6}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            disabled={running}
          />
        </div>
        <div className="field">
          <label htmlFor="guidelines">Diretrizes e contexto</label>
          <textarea
            id="guidelines"
            rows={12}
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            disabled={running}
          />
        </div>

        <div className="controls">
          <label className="rounds">
            Réplicas
            <select
              value={replyRounds}
              onChange={(e) => setReplyRounds(Number(e.target.value))}
              disabled={running}
            >
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>

          <div className="actions">
            <button
              type="button"
              className="btn ghost"
              onClick={refine}
              disabled={!canRun}
            >
              {refining ? "Refinando…" : "Refinar com IA"}
            </button>
            {!running ? (
              <button
                type="button"
                className="btn primary"
                onClick={runPanel}
                disabled={!canRun}
              >
                Rodar discussão
              </button>
            ) : (
              <button type="button" className="btn danger" onClick={stop}>
                Parar
              </button>
            )}
          </div>
        </div>

        {error && <p className="error">{error}</p>}
      </section>

      <DebateView
        transcript={transcript}
        currentRound={currentRound}
        running={running}
      />

      <VerdictView verdict={verdict} />

      {(transcript.length > 0 || verdict) && (
        <section className="export-bar">
          <p>Salvar discussão</p>
          <div className="actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => exportFile("txt")}
              disabled={running}
            >
              .txt
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => exportFile("doc")}
              disabled={running}
            >
              .doc
            </button>
          </div>
        </section>
      )}

      <footer className="foot">
        Não substitui validação de mercado. O útil são as hipóteses frágeis —
        teste com humanos na semana.
      </footer>
    </main>
  );
}
