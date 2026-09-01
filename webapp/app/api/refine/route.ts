import { NextRequest, NextResponse } from "next/server";
import { isLocale } from "@/lib/i18n";
import { isWorkspaceIdRequiredError, refineIdea } from "@/lib/panel";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key")?.trim();
  const workspaceId =
    req.headers.get("x-anthropic-workspace-id")?.trim() || undefined;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  let body: { idea?: string; guidelines?: string; locale?: string };
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

  try {
    const refined = await refineIdea(
      apiKey,
      idea,
      guidelines,
      locale,
      workspaceId,
    );
    return NextResponse.json(refined);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refine failed";
    return NextResponse.json(
      { error: message, needWorkspace: isWorkspaceIdRequiredError(message) },
      { status: 500 },
    );
  }
}
