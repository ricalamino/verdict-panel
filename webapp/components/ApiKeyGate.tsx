"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEY } from "@/lib/defaults";

type Props = {
  onReady: (key: string) => void;
};

export function ApiKeyGate({ onReady }: Props) {
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
          Anthropic API Key
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
          <button type="button" className="btn ghost" onClick={() => setShow((s) => !s)}>
            {show ? "Ocultar" : "Mostrar"}
          </button>
          <button type="button" className="btn primary" onClick={save} disabled={!key.trim()}>
            Salvar
          </button>
          {saved && (
            <button type="button" className="btn ghost" onClick={clear}>
              Limpar
            </button>
          )}
        </div>
        <p className="key-hint">
          Persistida só no seu <code>localStorage</code> — enviada ao servidor só na hora da chamada.
          {saved ? " ✓ salva." : ""}
        </p>
      </div>
    </section>
  );
}
