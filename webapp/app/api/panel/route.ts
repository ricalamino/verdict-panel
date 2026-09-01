import { NextRequest, NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n";
import { isWorkspaceIdRequiredError, runPanel } from "@/lib/panel";

export const runtime = "nodejs";
// Research alone can take ~2–3 min; debate after that. Was 300 and killed
// mid-research while the Anthropic request kept burning.
export const maxDuration = 600;

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

  const stream = new ReadableStream({
    async start(controller) {
      // Once the client disconnects the stream is gone; enqueueing into it
      // throws. Swallow that so it doesn't mask the real abort.
      const send = (data: unknown) => {
        if (req.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // stream already closed by the client
        }
      };

      try {
        for await (const event of runPanel(
          apiKey,
          idea,
          guidelines,
          replyRounds,
          locale,
          body.skipResearch === true,
          req.signal,
          firstHandEvidence,
          workspaceId,
        )) {
          send(event);
        }
      } catch (err) {
        // An abort is the user pressing Stop, not a failure worth reporting.
        if (!req.signal.aborted) {
          const message =
            err instanceof Error ? err.message : "Unknown panel error";
          send({
            type: "error",
            message,
            needWorkspace: isWorkspaceIdRequiredError(message),
          });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
