import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SEED_ORGANIZATION } from "@/lib/db/mock-db";
import { validateAndNormalizePhone } from "@/lib/sms/phone";
import {
  getOrCreateTenantSmsState,
  isProviderConfigured,
  dispatchSmsCampaign,
} from "@/lib/sms/engine";

export const dynamic = "force-dynamic";

const SUPABASE_READY = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "https://[PROJECT_REF].supabase.co"
);

export async function GET() {
  const cookieStore = await cookies();
  const isDemo = cookieStore.get("gtech_demo_mode")?.value === "true";

  if (isDemo) {
    const state = getOrCreateTenantSmsState(SEED_ORGANIZATION.id, true);
    const saved = state.userPhones.get("demo-operator") ?? {
      phoneNumber: SEED_ORGANIZATION.phone,
      normalizedPhoneNumber: "+254712345678",
      countryCode: "+254",
      verified: true,
      verifiedAt: SEED_ORGANIZATION.createdAt,
    };
    const parsed = validateAndNormalizePhone(saved.normalizedPhoneNumber);
    return NextResponse.json({
      success: true,
      data: {
        hasPhoneNumber: Boolean(saved.normalizedPhoneNumber),
        phoneNumber: saved.phoneNumber,
        normalizedPhoneNumber: saved.normalizedPhoneNumber,
        countryCode: saved.countryCode,
        formattedDisplay: parsed.valid ? parsed.formattedDisplay : saved.phoneNumber,
        verified: saved.verified,
        verifiedAt: saved.verifiedAt,
        smsProviderConfigured: isProviderConfigured(state.providerConfig),
        promptMessage: saved.normalizedPhoneNumber
          ? null
          : "Add your phone number to receive important account and service notifications.",
        isDemo: true,
      },
    });
  }

  if (!SUPABASE_READY) {
    return NextResponse.json({
      success: true,
      data: {
        hasPhoneNumber: false,
        phoneNumber: "",
        normalizedPhoneNumber: "",
        countryCode: "+254",
        formattedDisplay: "Not set",
        verified: false,
        verifiedAt: null,
        smsProviderConfigured: false,
        promptMessage:
          "Add your phone number to receive important account and service notifications.",
        isDemo: false,
      },
    });
  }

  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Your session has expired. Please sign in again." },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id, full_name, phone_number, role")
      .eq("id", user.id)
      .single();

    const orgId = profile?.organization_id || `org-user-${user.id}`;
    const state = getOrCreateTenantSmsState(orgId, false);
    const rawPhone =
      profile?.phone_number ||
      (user.user_metadata?.phone_number as string | undefined) ||
      "";
    const parsed = rawPhone ? validateAndNormalizePhone(rawPhone) : null;
    const cachedVerification = state.userPhones.get(user.id);

    return NextResponse.json({
      success: true,
      data: {
        hasPhoneNumber: Boolean(parsed?.valid),
        phoneNumber: rawPhone,
        normalizedPhoneNumber: parsed?.valid ? parsed.normalizedPhoneNumber : "",
        countryCode: parsed?.valid ? parsed.countryCode : "+254",
        formattedDisplay: parsed?.valid ? parsed.formattedDisplay : rawPhone || "Not set",
        verified: cachedVerification?.verified ?? false,
        verifiedAt: cachedVerification?.verifiedAt ?? null,
        smsProviderConfigured: isProviderConfigured(state.providerConfig),
        promptMessage: parsed?.valid
          ? null
          : "Add your phone number to receive important account and service notifications.",
        isDemo: false,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to load profile phone number." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request payload." },
      { status: 400 }
    );
  }

  const rawPhone = typeof body.phoneNumber === "string" ? body.phoneNumber : "";
  const validation = validateAndNormalizePhone(rawPhone);

  if (!validation.valid) {
    return NextResponse.json(
      {
        success: false,
        code: "INVALID_PHONE",
        message: validation.error || "Please enter a valid phone number.",
        error: validation.error || "Please enter a valid phone number.",
      },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const isDemo = cookieStore.get("gtech_demo_mode")?.value === "true";

  if (isDemo || !SUPABASE_READY) {
    const state = getOrCreateTenantSmsState(SEED_ORGANIZATION.id, true);
    state.userPhones.set("demo-operator", {
      phoneNumber: validation.rawInput,
      normalizedPhoneNumber: validation.normalizedPhoneNumber,
      countryCode: validation.countryCode,
      verified: false,
    });
    return NextResponse.json({
      success: true,
      message: "Phone number validated and saved.",
      data: {
        phoneNumber: validation.rawInput,
        normalizedPhoneNumber: validation.normalizedPhoneNumber,
        countryCode: validation.countryCode,
        formattedDisplay: validation.formattedDisplay,
        verified: false,
        smsProviderConfigured: isProviderConfigured(state.providerConfig),
      },
    });
  }

  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Your session has expired. Please sign in again." },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id, role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { success: false, message: "User profile not found." },
        { status: 404 }
      );
    }

    await supabase
      .from("profiles")
      .update({
        phone_number: validation.normalizedPhoneNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // Keep linked customer record synchronized if user is linked to a customer row
    await supabase
      .from("customers")
      .update({
        phone_number: validation.normalizedPhoneNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", profile.organization_id)
      .eq("auth_user_id", user.id);

    const state = getOrCreateTenantSmsState(profile.organization_id, false);
    state.userPhones.set(user.id, {
      phoneNumber: validation.rawInput,
      normalizedPhoneNumber: validation.normalizedPhoneNumber,
      countryCode: validation.countryCode,
      verified: false,
    });

    return NextResponse.json({
      success: true,
      message: "Phone number validated and saved.",
      data: {
        phoneNumber: validation.rawInput,
        normalizedPhoneNumber: validation.normalizedPhoneNumber,
        countryCode: validation.countryCode,
        formattedDisplay: validation.formattedDisplay,
        verified: false,
        smsProviderConfigured: isProviderConfigured(state.providerConfig),
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Unable to save phone number right now." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request payload." },
      { status: 400 }
    );
  }

  const action = String(body.action || "SEND_OTP").toUpperCase();
  const cookieStore = await cookies();
  const isDemo = cookieStore.get("gtech_demo_mode")?.value === "true";

  let orgId = SEED_ORGANIZATION.id;
  let userId = "demo-operator";

  if (!isDemo && SUPABASE_READY) {
    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          { success: false, message: "Authentication required." },
          { status: 401 }
        );
      }
      userId = user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (profile?.organization_id) {
        orgId = profile.organization_id;
      }
    } catch {
      return NextResponse.json(
        { success: false, message: "Unable to verify session." },
        { status: 500 }
      );
    }
  }

  const state = getOrCreateTenantSmsState(orgId, isDemo);

  if (action === "SEND_OTP") {
    const rawPhone = String(body.phoneNumber || "");
    const parsed = validateAndNormalizePhone(rawPhone);
    if (!parsed.valid) {
      return NextResponse.json(
        { success: false, message: parsed.error || "Invalid phone number." },
        { status: 400 }
      );
    }

    if (!isProviderConfigured(state.providerConfig)) {
      return NextResponse.json({
        success: false,
        code: "PROVIDER_NOT_CONFIGURED",
        providerConfigured: false,
        message:
          "SMS provider not configured. Connect an SMS provider in Settings to send OTP verification codes.",
      });
    }

    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    state.pendingOtps.set(userId, {
      normalizedPhone: parsed.normalizedPhoneNumber,
      otpCode,
      expiresAt: Date.now() + 10 * 60 * 1000,
      attempts: 0,
    });

    // Record OTP dispatch in SMS logs
    dispatchSmsCampaign({
      organizationId: orgId,
      actorId: userId,
      actorName: "Account Security",
      actorRole: "isp_owner",
      recipientMode: "INDIVIDUAL",
      messageType: "OTP_VERIFICATION",
      category: "TRANSACTIONAL",
      messageTemplate: `Your QC NetCore verification code is ${otpCode}. Valid for 10 minutes.`,
      filters: { customerId: "cust-01" },
      confirmed: true,
      isDemoMode: isDemo,
    });

    return NextResponse.json({
      success: true,
      providerConfigured: true,
      message: `Verification code sent to ${parsed.formattedDisplay}.`,
      // In demo/sandbox mode, surface demoHint so operator can test verification seamlessly
      demoOtpHint:
        isDemo || state.providerConfig.environment === "SANDBOX"
          ? otpCode
          : undefined,
    });
  }

  if (action === "VERIFY_OTP") {
    const submittedOtp = String(body.otp || "").trim();
    const pending = state.pendingOtps.get(userId);
    if (!pending) {
      return NextResponse.json(
        {
          success: false,
          message: "No active verification code found. Please request a new code.",
        },
        { status: 400 }
      );
    }

    if (Date.now() > pending.expiresAt) {
      state.pendingOtps.delete(userId);
      return NextResponse.json(
        {
          success: false,
          message: "Verification code has expired. Please request a new code.",
        },
        { status: 400 }
      );
    }

    pending.attempts += 1;
    if (pending.attempts > 5) {
      state.pendingOtps.delete(userId);
      return NextResponse.json(
        {
          success: false,
          message: "Too many failed attempts. Please request a new verification code.",
        },
        { status: 429 }
      );
    }

    if (submittedOtp !== pending.otpCode) {
      return NextResponse.json(
        {
          success: false,
          message: "Incorrect verification code. Please check and try again.",
        },
        { status: 400 }
      );
    }

    const verifiedAt = new Date().toISOString();
    state.userPhones.set(userId, {
      phoneNumber: pending.normalizedPhone,
      normalizedPhoneNumber: pending.normalizedPhone,
      countryCode: validateAndNormalizePhone(pending.normalizedPhone).countryCode,
      verified: true,
      verifiedAt,
    });
    state.pendingOtps.delete(userId);

    return NextResponse.json({
      success: true,
      message: "Phone number verified and saved.",
      data: {
        normalizedPhoneNumber: pending.normalizedPhone,
        verified: true,
        verifiedAt,
      },
    });
  }

  return NextResponse.json(
    { success: false, message: "Unsupported verification action." },
    { status: 400 }
  );
}
