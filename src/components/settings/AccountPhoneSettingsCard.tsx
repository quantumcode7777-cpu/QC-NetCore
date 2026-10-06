"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Phone, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { btnClass } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils";
import { validateAndNormalizePhone } from "@/lib/sms/phone";

export function AccountPhoneSettingsCard() {
  const [phoneInput, setPhoneInput] = useState("");
  const [formattedDisplay, setFormattedDisplay] = useState("");
  const [hasPhone, setHasPhone] = useState(true);
  const [verified, setVerified] = useState(false);
  const [smsProviderConfigured, setSmsProviderConfigured] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // OTP state
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [demoOtpHint, setDemoOtpHint] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadAccountPhone = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/settings/phone", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json?.success && json.data) {
        setPhoneInput(
          json.data.normalizedPhoneNumber || json.data.phoneNumber || ""
        );
        setFormattedDisplay(json.data.formattedDisplay || "");
        setHasPhone(Boolean(json.data.hasPhoneNumber));
        setVerified(Boolean(json.data.verified));
        setSmsProviderConfigured(Boolean(json.data.smsProviderConfigured));
      }
    } catch {
      // Non-fatal fallback
    }
  }, []);

  useEffect(() => {
    loadAccountPhone();
  }, [loadAccountPhone]);

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMsg(null);

    const check = validateAndNormalizePhone(phoneInput);
    if (!check.valid) {
      setError(
        check.error ||
          "Please enter a valid phone number (e.g. 0712052104 or +254712052104)."
      );
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/v1/settings/phone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: check.normalizedPhoneNumber }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setError(json?.message || "Could not update phone number.");
        return;
      }

      setPhoneInput(json.data.normalizedPhoneNumber);
      setFormattedDisplay(json.data.formattedDisplay);
      setHasPhone(true);
      setVerified(Boolean(json.data.verified));
      setIsEditing(false);
      setStatusMsg(
        `Saved normalized phone number (${json.data.formattedDisplay}).`
      );
    } catch {
      setError("Unable to save phone number right now.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendOtp = async () => {
    setError(null);
    setStatusMsg(null);
    const check = validateAndNormalizePhone(phoneInput);
    if (!check.valid) {
      setError(check.error || "Enter a valid phone number first.");
      return;
    }

    const res = await fetch("/api/v1/settings/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SEND_OTP",
        phoneNumber: check.normalizedPhoneNumber,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.success) {
      setStatusMsg(
        json?.message ||
          "SMS provider not configured. Connect an SMS provider to verify via OTP."
      );
      return;
    }
    setOtpRequested(true);
    setDemoOtpHint(json.demoOtpHint || null);
    setStatusMsg(json.message || "Verification code sent.");
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/v1/settings/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "VERIFY_OTP",
        otp: otpInput,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.success) {
      setError(json?.message || "Invalid verification code.");
      return;
    }
    setVerified(true);
    setOtpRequested(false);
    setOtpInput("");
    setDemoOtpHint(null);
    setStatusMsg("Phone number verified and saved.");
  };

  return (
    <div className="rounded-md border border-border bg-surface-subtle p-3 space-y-2.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <Phone className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          <span>Account Phone Number</span>
        </div>
        {hasPhone && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
              verified
                ? "bg-success-soft text-success"
                : "bg-primary-soft text-primary"
            )}
          >
            {verified ? (
              <>
                <CheckCircle2 className="h-3 w-3" /> Verified
              </>
            ) : (
              "Normalized E.164"
            )}
          </span>
        )}
      </div>

      {/* Section 41: Backward compatibility notice for existing accounts without a phone number */}
      {!hasPhone && (
        <div className="flex items-start gap-2 rounded border border-warning/40 bg-warning-soft p-2 text-[11px] text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Add your phone number to receive important account and service notifications.
          </span>
        </div>
      )}

      {!isEditing ? (
        <div className="flex items-center justify-between gap-2">
          <div className="font-mono text-xs font-semibold text-foreground">
            {formattedDisplay || phoneInput || "No phone number configured"}
          </div>
          <div className="flex items-center gap-1.5">
            {hasPhone && !verified && smsProviderConfigured && (
              <button
                type="button"
                onClick={handleSendOtp}
                className="rounded border border-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-elevated"
              >
                Verify OTP
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                setError(null);
                setStatusMsg(null);
              }}
              className="rounded border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-surface-elevated"
            >
              {hasPhone ? "Change" : "Add Phone"}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSavePhone} className="space-y-2">
          <label
            htmlFor="account-phone-input"
            className="block text-[11px] text-muted-foreground"
          >
            Enter Kenyan (0712052104) or international (+254712052104) number:
          </label>
          <input
            id="account-phone-input"
            type="tel"
            required
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="0712052104 or +254712052104"
            className="h-8 w-full rounded border border-border bg-surface px-2.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setError(null);
              }}
              className={cn(btnClass("secondary"), "h-7 px-2.5 text-xs")}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={cn(btnClass("primary"), "h-7 px-2.5 text-xs")}
            >
              {isSaving ? "Saving…" : "Validate & Save"}
            </button>
          </div>
        </form>
      )}

      {otpRequested && (
        <form
          onSubmit={handleVerifyOtp}
          className="space-y-2 rounded border border-border bg-surface p-2.5"
        >
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-foreground">
              Enter 6-digit SMS OTP
            </span>
            {demoOtpHint && (
              <span className="font-mono text-[10px] text-primary">
                Sandbox OTP: {demoOtpHint}
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              maxLength={6}
              required
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
              placeholder="123456"
              className="h-8 flex-1 rounded border border-border bg-surface-subtle px-2.5 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              className={cn(btnClass("primary"), "h-8 px-3 text-xs")}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Confirm
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="rounded border border-danger/30 bg-danger-soft p-2 text-[11px] text-danger">
          {error}
        </div>
      )}

      {statusMsg && (
        <div className="rounded border border-success/30 bg-success-soft p-2 text-[11px] text-success">
          {statusMsg}
        </div>
      )}
    </div>
  );
}
