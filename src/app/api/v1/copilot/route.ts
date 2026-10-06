import { NextResponse } from "next/server";
import {
  executeCopilotIntelligence,
  type CopilotConversationMemory,
} from "@/lib/ai/copilot";
import { loadLiveOrDemoCopilotEnvironment } from "@/lib/ai/live-data-loader";
import { hasPermission } from "@/lib/auth/rbac";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const memory = (body?.conversationContext || undefined) as
      | CopilotConversationMemory
      | undefined;
    const explicitDemoMode =
      typeof body?.isDemoMode === "boolean" ? body.isDemoMode : undefined;

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Enter a question or operational command." },
        { status: 400 }
      );
    }

    const { ctx, dataset } = await loadLiveOrDemoCopilotEnvironment({
      explicitDemoMode,
    });

    if (!hasPermission(ctx.userRole, "copilot.use")) {
      return NextResponse.json(
        {
          success: false,
          error: "You don't have permission to use the AI Operations Copilot.",
        },
        { status: 403 }
      );
    }

    const result = executeCopilotIntelligence({
      prompt,
      ctx,
      dataset,
      memory,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "AI Copilot could not process the request." },
      { status: 500 }
    );
  }
}
