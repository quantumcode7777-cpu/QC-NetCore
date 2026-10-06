"use client";
import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalCustomizer } from "@/components/captive/PortalCustomizer";

export default function CaptivePortalDesignerPage() {
  return (
    <AppShell title="Captive Portal Designer">
      <PageHeader
        title="Captive Portal Designer"
        description="Customize the WiFi login page your customers see. Edit, preview, save a draft, test, then publish."
      />
      <PortalCustomizer />
    </AppShell>
  );
}
