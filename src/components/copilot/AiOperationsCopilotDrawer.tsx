"use client";

import React, { useEffect, useState } from "react";
import {
  Sparkles,
  Send,
  X,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { btnClass } from "@/components/ui/PageHeader";
import {
  runCopilotQuery,
  type CopilotResponse,
  type CopilotConversationMemory,
} from "@/lib/ai/copilot";
import { buildSeedCopilotSnapshot } from "@/lib/db/os-2027-seed";
import { useAuth } from "@/lib/auth/auth-context";

const DEMO_QUICK_PROMPTS = [
  "Who is our newest subscriber?",
  "How many active subscribers do we have?",
  "Why is David Koech (GT-8923) offline?",
  "Which customers owe us the most?",
  "How much did we collect today?",
  "Which router has the most active sessions?",
  "How is the business performing?",
  "What can QC NetCore do?",
];

const LIVE_QUICK_PROMPTS = [
  "Who is our newest subscriber?",
  "How many active subscribers do we have?",
  "Which customers owe us the most?",
  "How much did we collect today?",
  "Which router has the most active sessions?",
  "How is the business performing?",
  "What can QC NetCore do?",
];

export function AiOperationsCopilotDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { isDemoMode } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [memory, setMemory] = useState<CopilotConversationMemory>({});
  const [history, setHistory] = useState<
    Array<{ query: string; response: CopilotResponse }>
  >(() => {
    if (!isDemoMode) return [];
    const snap = buildSeedCopilotSnapshot();
    return [
      {
        query: "Operational system status brief",
        response: runCopilotQuery("General operations brief", snap),
      },
    ];
  });
  const [confirmedActions, setConfirmedActions] = useState<Record<string, boolean>>(
    {}
  );

  useEffect(() => {
    if (isDemoMode) {
      const snap = buildSeedCopilotSnapshot();
      setHistory([
        {
          query: "Operational system status brief",
          response: runCopilotQuery("General operations brief", snap),
        },
      ]);
    } else {
      setHistory([]);
    }
  }, [isDemoMode]);

  if (!open) return null;

  const quickPrompts = isDemoMode ? DEMO_QUICK_PROMPTS : LIVE_QUICK_PROMPTS;

  const handleAsk = async (qText: string) => {
    const trimmed = qText.trim();
    if (!trimmed || isLoading) return;
    setPrompt("");
    setIsLoading(true);

    try {
      const apiRes = await fetch("/api/v1/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          conversationContext: memory,
          isDemoMode,
        }),
      });
      const json = await apiRes.json();

      if (json?.success && json.data) {
        const res = json.data as CopilotResponse;
        if (res.conversationContext) {
          setMemory(res.conversationContext);
        }
        setHistory((prev) => [{ query: trimmed, response: res }, ...prev]);
        setIsLoading(false);
        return;
      }
    } catch {
      // Fallback only in demo mode
    }

    if (isDemoMode) {
      const fallbackRes = runCopilotQuery(trimmed, undefined, memory);
      if (fallbackRes.conversationContext) {
        setMemory(fallbackRes.conversationContext);
      }
      setHistory((prev) => [{ query: trimmed, response: fallbackRes }, ...prev]);
    } else {
      setHistory((prev) => [
        {
          query: trimmed,
          response: {
            intent: "GENERAL_OPERATIONS_BRIEF",
            headline: "Unable to Reach Live Operations API",
            answerMarkdown:
              "Could not retrieve live workspace telemetry at this moment. Please verify your connection and try again.",
            metricsCited: [],
            proposedActions: [],
          },
        },
        ...prev,
      ]);
    }
    setIsLoading(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="QC NetCore AI ISP Operations Copilot"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full w-full max-w-lg flex-col border-l border-border bg-surface text-foreground shadow-[var(--shadow-pop)]">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">
                  AI ISP Operations Copilot
                </h2>
                {isDemoMode && (
                  <span className="inline-flex items-center rounded border border-primary/30 bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    Demo workspace
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ask about subscribers, billing, payments, routers, sessions, and ISP operations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Copilot"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-elevated"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Quick Prompts */}
        <div className="border-b border-border bg-surface-subtle p-3">
          <div className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            Suggested questions:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((qp) => (
              <button
                key={qp}
                type="button"
                onClick={() => handleAsk(qp)}
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-left text-xs text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {qp}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Responses */}
        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
          {history.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface-subtle p-4 text-center text-muted-foreground">
              Ask a question above or select a suggested prompt to inspect your live ISP workspace data.
            </div>
          ) : null}
          {history.map((item, idx) => (
            <div
              key={`${item.query}-${idx}`}
              className="rounded-lg border border-border bg-surface-subtle p-3.5 space-y-3"
            >
              <div className="border-b border-border pb-2">
                <span className="font-semibold text-primary">
                  {item.query}
                </span>
              </div>

              <div>
                <div className="font-semibold text-foreground">
                  {item.response.headline}
                </div>
                <div className="mt-1.5 whitespace-pre-line leading-relaxed text-muted-foreground">
                  {item.response.answerMarkdown}
                </div>
              </div>

              {/* Cited Authoritative Metrics */}
              {item.response.metricsCited.length > 0 && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {item.response.metricsCited.map((m) => (
                    <div
                      key={m.label}
                      className="rounded border border-border bg-surface p-2"
                    >
                      <div className="text-[10px] text-muted-foreground">
                        {m.label}
                      </div>
                      <div className="font-mono text-xs font-semibold text-foreground">
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Confirmation-Gated Actions */}
              {item.response.proposedActions.map((act) => {
                const confirmed = Boolean(confirmedActions[act.actionId]);
                return (
                  <div
                    key={act.actionId}
                    className="rounded-md border border-primary/25 bg-surface p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        Recommended Action
                      </span>
                    </div>
                    {confirmed ? (
                      <div className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Action confirmed
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmedActions((prev) => ({
                            ...prev,
                            [act.actionId]: true,
                          }))
                        }
                        className={btnClass("primary", "h-7 px-2.5 text-xs")}
                      >
                        {act.label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Prompt Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(prompt);
          }}
          className="flex items-center gap-2 border-t border-border p-3"
        >
          <input
            type="text"
            aria-label="Ask AI ISP Operations Copilot"
            placeholder="Ask about newest subscriber, IPs, overdue accounts, revenue, or routers…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="h-9 flex-1 rounded-md border border-border bg-surface px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading}
            className={cn(btnClass("primary", "h-9 px-3 text-xs"))}
          >
            <Send className="h-3.5 w-3.5" />
            {isLoading ? "Querying…" : "Ask"}
          </button>
        </form>
      </div>
    </div>
  );
}
