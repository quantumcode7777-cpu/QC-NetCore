"use client";
import React from "react";
import Link from "next/link";
import { ArrowLeft, Radio } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center antialiased">
      <div className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center text-primary mb-4 shadow-xs">
        <Radio className="w-6 h-6" />
      </div>
      <div className="text-xs uppercase font-bold tracking-wider px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 mb-2">
        404 Page Not Found
      </div>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
        Lost in the Network Grid
      </h1>
      <p className="max-w-md text-sm text-muted-foreground mt-2 leading-relaxed">
        The requested routing node or management plane endpoint does not exist on this gateway.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-bold shadow-brand-btn transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
}
