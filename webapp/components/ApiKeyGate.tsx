"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEY, STORAGE_WORKSPACE_ID } from "@/lib/defaults";
import type { Messages } from "@/lib/i18n";

type Props = {
  onReady: (key: string, workspaceId: string) => void;
  t: Messages;
};

export function ApiKeyGate({ onReady, t }: Props) {
  const [key, setKey] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [saved, setSaved] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const storedKey = localStorage.getItem(STORAGE_KEY) ?? "";
    const storedWs = localStorage.getItem(STORAGE_WORKSPACE_ID) ?? "";
    if (storedKey) {
      setKey(storedKey);
      setWorkspaceId(storedWs);
      setSaved(true);
      onReady(storedKey, storedWs);
    }
  }, [onReady]);

  function save() {
    const trimmed = key.trim();
    if (!trimmed) return;
    const ws = workspaceId.trim();
    localStorage.setItem(STORAGE_KEY, trimmed);
    if (ws) localStorage.setItem(STORAGE_WORKSPACE_ID, ws);
    else localStorage.removeItem(STORAGE_WORKSPACE_ID);
    setSaved(true);
    onReady(trimmed, ws);
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_WORKSPACE_ID);
    setKey("");
    setWorkspaceId("");
    setSaved(false);
    onReady("", "");
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

        <label htmlFor="workspace-id" className="key-label key-label-spaced">
          {t.workspaceIdLabel}
        </label>
        <div className="key-row">
          <input
            id="workspace-id"
            type="text"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            placeholder={t.workspaceIdPlaceholder}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <p className="key-hint">
          {t.keyHint}
          {saved ? t.keySaved : ""}
        </p>
        <p className="key-hint">{t.workspaceIdHint}</p>
      </div>
    </section>
  );
}
