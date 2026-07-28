"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEY } from "@/lib/defaults";
import type { Messages } from "@/lib/i18n";

type Props = {
  onReady: (key: string) => void;
  t: Messages;
};

export function ApiKeyGate({ onReady, t }: Props) {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setKey(stored);
      setSaved(true);
      onReady(stored);
    }
  }, [onReady]);

  function save() {
    const trimmed = key.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    setSaved(true);
    onReady(trimmed);
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    setKey("");
    setSaved(false);
    onReady("");
  }

  return (
    <section className="key-bar" aria-label="API key">
      <div className="key-bar-inner">
        <label htmlFor="api-key" className="key-label">
          {t.apiKeyLabel}
        </label>
        <div className="key-row">
          <input
            id="api-key"
            type={show ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="btn ghost"
            onClick={() => setShow((s) => !s)}
          >
            {show ? t.hide : t.show}
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={save}
            disabled={!key.trim()}
          >
            {t.save}
          </button>
          {saved && (
            <button type="button" className="btn ghost" onClick={clear}>
              {t.clear}
            </button>
          )}
        </div>
        <p className="key-hint">
          {t.keyHint}
          {saved ? t.keySaved : ""}
        </p>
      </div>
    </section>
  );
}
