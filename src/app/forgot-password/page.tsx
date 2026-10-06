"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, ShieldCheck, Sun, Moon, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { classifyAuthError } from "@/lib/supabase/errors";
import { NexaNetLogo } from "@/components/ui/NexaNetLogo";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/sign-in`,
      });

      if (resetErr) {
        setError(classifyAuthError(resetErr, "reset"));
      } else {
        setSuccess("Password reset instructions have been sent to your email address.");
      }
    } catch {
      setError("Unable to send password reset instructions. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between antialiased selection:bg-primary/20 selection:text-primary transition-colors duration-200">
      <header className="w-full border-b border-border-subtle bg-surface/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center group">
            <NexaNetLogo variant="horizontal" />
          </Link>

          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl bg-surface border border-border text-foreground flex items-center justify-center hover:bg-surface-elevated transition-colors"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-primary" />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Account Recovery</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Reset Your Password
            </h1>
            <p className="text-xs text-muted-foreground">
              Enter your registered email address to receive password recovery instructions
            </p>
          </div>

          <div className="p-6 sm:p-8 rounded-2xl bg-surface border border-border shadow-xs space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-elevated border border-border text-sm text-foreground focus:outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground font-bold text-sm transition flex items-center justify-center gap-2 shadow-brand-btn disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Sending Instructions...</span>
                ) : (
                  <>
                    <span>Send Reset Password Link</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center">
              <Link href="/sign-in" className="text-xs text-primary font-bold hover:underline">
                Return to Sign In
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 border-t border-border bg-surface-subtle text-center text-xs text-muted-foreground">
        &copy; 2026 QC NetCore Network &amp; Billing.
      </footer>
    </div>
  );
}
