import { NextRequest, NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n";
import { runPanel } from "@/lib/panel";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key")?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  let body: {
    idea?: string;
    guidelines?: string;
    replyRounds?: number;
    locale?: string;
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
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        for await (const event of runPanel(
          apiKey,
          idea,
          guidelines,
          replyRounds,
          locale,
        )) {
          send(event);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown panel error";
        send({ type: "error", message });
      } finally {
        controller.close();
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
