"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiKeyGate } from "@/components/ApiKeyGate";
import { BriefingView, DebateView, VerdictView } from "@/components/DebateView";
import {
  buildExportText,
  downloadBriefingJson,
  downloadDoc,
  downloadTxt,
} from "@/lib/export";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getMessages,
  isLocale,
  type Locale,
} from "@/lib/i18n";
import type { PanelEvent, TranscriptEntry } from "@/lib/panel";
import type { Briefing, ResearchAudit } from "@/lib/research";

export default function HomePage() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [hydrated, setHydrated] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [idea, setIdea] = useState(() => getMessages(DEFAULT_LOCALE).defaultIdea);
  const [guidelines, setGuidelines] = useState(
    () => getMessages(DEFAULT_LOCALE).defaultGuidelines,
  );
  const [firstHand, setFirstHand] = useState("");
  const [replyRounds, setReplyRounds] = useState(1);
  const [skipResearch, setSkipResearch] = useState(false);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [audit, setAudit] = useState<ResearchAudit | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const t = useMemo(() => getMessages(locale), [locale]);

  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    const next = isLocale(stored) ? stored : DEFAULT_LOCALE;
    setLocale(next);
    const msgs = getMessages(next);
    setIdea(msgs.defaultIdea);
    setGuidelines(msgs.defaultGuidelines);
    document.documentElement.lang = next === "pt" ? "pt-BR" : "en";
    setHydrated(true);
  }, []);

  function changeLocale(next: Locale) {
    if (next === locale) return;
    const prev = getMessages(locale);
    const msgs = getMessages(next);
    // Swap templates only if user hasn't customized them
    if (idea.trim() === prev.defaultIdea.trim()) setIdea(msgs.defaultIdea);
    if (guidelines.trim() === prev.defaultGuidelines.trim()) {
      setGuidelines(msgs.defaultGuidelines);
    }
    setLocale(next);
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
    document.documentElement.lang = next === "pt" ? "pt-BR" : "en";
  }

  const onReady = useCallback((key: string, ws: string) => {
    setApiKey(key);
    setWorkspaceId(ws);
  }, []);

  async function refine() {
    if (!apiKey) {
      setError(t.errNeedKey);
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
          ...(workspaceId ? { "x-anthropic-workspace-id": workspaceId } : {}),
        },
        body: JSON.stringify({ idea, guidelines, locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.needWorkspace ? t.errNeedWorkspace : data.error || t.errRefine,
        );
      }
      setIdea(data.idea);
      setGuidelines(data.guidelines);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.errRefine);
    } finally {
      setRefining(false);
    }
  }

  async function runPanel() {
    if (!apiKey) {
      setError(t.errNeedKey);
      return;
    }
    if (!idea.trim() || !guidelines.trim()) {
      setError(t.errNeedFields);
      return;
    }

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setRunning(true);
    setError(null);
    setTranscript([]);
    setVerdict(null);
    setBriefing(null);
    setAudit(null);
    setCurrentRound(t.starting);

    try {
      const res = await fetch("/api/panel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          ...(workspaceId ? { "x-anthropic-workspace-id": workspaceId } : {}),
        },
        body: JSON.stringify({
          idea,
          guidelines,
          replyRounds,
          locale,
          skipResearch,
          firstHandEvidence: firstHand,
        }),
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
          if (event.type === "briefing") {
            setBriefing(event.briefing);
            setAudit(event.audit);
          }
          if (event.type === "speech") {
            setTranscript((prev) => [...prev, event.entry]);
          }
          if (event.type === "verdict") {
            setVerdict(event.text);
            setCurrentRound(null);
          }
          if (event.type === "error") {
            throw new Error(
              event.needWorkspace ? t.errNeedWorkspace : event.message,
            );
          }
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : t.errPanel);
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

  function exportFile(format: "txt" | "doc" | "json") {
    if (!verdict && !transcript.length && !briefing) return;
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "json") {
      downloadBriefingJson(`validation-briefing-${stamp}.json`, {
        idea,
        guidelines,
        briefing,
        audit,
      });
      return;
    }

    const text = buildExportText({
      idea,
      guidelines,
      briefing,
      audit,
      transcript,
      verdict: verdict ?? t.noVerdict,
      t,
    });
    if (format === "txt") {
      downloadTxt(`validation-panel-${stamp}.txt`, text);
    } else {
      downloadDoc(`validation-panel-${stamp}.doc`, text, verdict ?? "", t);
    }
  }

  const canRun = Boolean(apiKey) && !running && !refining;

  if (!hydrated) {
    return <main className="page" />;
  }

  return (
    <main className="page">
      <header className="hero">
        <div className="hero-top">
          <p className="brand">{t.brand}</p>
          <label className="lang-switch">
            <span className="sr-only">{t.language}</span>
            <select
              value={locale}
              onChange={(e) => changeLocale(e.target.value as Locale)}
              disabled={running || refining}
              aria-label={t.language}
            >
              <option value="en">English</option>
              <option value="pt">Português</option>
            </select>
          </label>
        </div>
        <h1>{t.title}</h1>
        <p className="lede">{t.lede}</p>
      </header>

      <ApiKeyGate onReady={onReady} t={t} />

      <section className="brief">
        <div className="field">
          <label htmlFor="idea">{t.ideaLabel}</label>
          <textarea
            id="idea"
            rows={6}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            disabled={running}
          />
        </div>
        <div className="field">
          <label htmlFor="guidelines">{t.guidelinesLabel}</label>
          <textarea
            id="guidelines"
            rows={12}
            value={guidelines}
            onChange={(e) => setGuidelines(e.target.value)}
            disabled={running}
          />
        </div>
        <div className="field">
          <label htmlFor="firstHand">{t.firstHandLabel}</label>
          <textarea
            id="firstHand"
            rows={8}
            value={firstHand}
            onChange={(e) => setFirstHand(e.target.value)}
            disabled={running}
            placeholder={t.firstHandHint}
          />
          <p className="field-hint">{t.firstHandHint}</p>
        </div>

        <div className="controls">
          <label className="rounds">
            {t.replies}
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

          <label className="toggle">
            <input
              type="checkbox"
              checked={skipResearch}
              onChange={(e) => setSkipResearch(e.target.checked)}
              disabled={running}
            />
            {t.skipResearch}
          </label>

          <div className="actions">
            <button
              type="button"
              className="btn ghost"
              onClick={refine}
              disabled={!canRun}
            >
              {refining ? t.refining : t.refine}
            </button>
            {!running ? (
              <button
                type="button"
                className="btn primary"
                onClick={runPanel}
                disabled={!canRun}
              >
                {t.run}
              </button>
            ) : (
              <button type="button" className="btn danger" onClick={stop}>
                {t.stop}
              </button>
            )}
          </div>
        </div>

        {error && <p className="error">{error}</p>}
      </section>

      <BriefingView briefing={briefing} audit={audit} t={t} />

      <DebateView
        transcript={transcript}
        currentRound={currentRound}
        running={running}
        t={t}
      />

      <VerdictView verdict={verdict} t={t} />

      {(transcript.length > 0 || verdict || briefing) && (
        <section className="export-bar">
          <p>{t.saveDiscussion}</p>
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
            {briefing && (
              <button
                type="button"
                className="btn ghost"
                onClick={() => exportFile("json")}
                disabled={running}
              >
                .json
              </button>
            )}
          </div>
        </section>
      )}

      <footer className="foot">{t.footer}</footer>
    </main>
  );
}
