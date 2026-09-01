import { NextRequest, NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n";
import {
  isAbortError,
  isWorkspaceIdRequiredError,
  runPanel,
} from "@/lib/panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Research alone can take ~2–3 min; debate after that. Was 300 and killed
// mid-research while the Anthropic request kept burning.
export const maxDuration = 600;

const HEARTBEAT_MS = 10_000;

function isConnectionError(message: string) {
  return /connection|network|ECONNRESET|ETIMEDOUT|socket|fetch failed/i.test(
    message,
  );
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key")?.trim();
  const workspaceId =
    req.headers.get("x-anthropic-workspace-id")?.trim() || undefined;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  let body: {
    idea?: string;
    guidelines?: string;
    replyRounds?: number;
    locale?: string;
    skipResearch?: boolean;
    firstHandEvidence?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const idea = body.idea?.trim();
  const guidelines = body.guidelines?.trim();
  if (!idea || !guidelines) {
    return NextResponse.json(
      { error: "idea and guidelines are required" },
      { status: 400 },
    );
  }

  const rawLocale = body.locale ?? "en";
  const locale = isLocale(rawLocale) ? rawLocale : "en";
  const replyRounds = Math.min(2, Math.max(0, body.replyRounds ?? 1));
  const firstHandEvidence = body.firstHandEvidence?.trim() ?? "";
  const encoder = new TextEncoder();

  const abort = new AbortController();
  const stop = () => {
    if (!abort.signal.aborted) abort.abort();
  };
  req.signal.addEventListener("abort", stop);

  const stream = new ReadableStream({
    async start(controller) {
      const sendRaw = (chunk: string) => {
        if (abort.signal.aborted) return false;
        try {
          controller.enqueue(encoder.encode(chunk));
          return true;
        } catch {
          stop();
          return false;
        }
      };

      const send = (data: unknown) => {
        sendRaw(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Idle SSE (research can sit 2–3 min with no events) gets killed by
      // Node requestTimeout / Docker / WSL / browsers — while Anthropic
      // keeps running and billing. Ping + padding forces a flush.
      const heartbeat = setInterval(() => {
        const pad = " ".repeat(1024);
        sendRaw(`: ka ${Date.now()}${pad}\n\ndata: {"type":"heartbeat"}\n\n`);
      }, HEARTBEAT_MS);

      try {
        for await (const event of runPanel(
          apiKey,
          idea,
          guidelines,
          replyRounds,
          locale,
          body.skipResearch === true,
          abort.signal,
          firstHandEvidence,
          workspaceId,
        )) {
          send(event);
        }
      } catch (err) {
        if (isAbortError(err) || abort.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Unknown panel error";
        send({
          type: "error",
          message,
          needWorkspace: isWorkspaceIdRequiredError(message),
          connection: isConnectionError(message),
        });
      } finally {
        clearInterval(heartbeat);
        req.signal.removeEventListener("abort", stop);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "none",
    },
  });
}
