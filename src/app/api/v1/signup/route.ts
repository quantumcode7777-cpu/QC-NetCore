import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { classifyAuthError } from "@/lib/supabase/errors";
import { validateAndNormalizePhone } from "@/lib/sms/phone";

export const dynamic = "force-dynamic";

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

function validationError(field: string, message: string) {
  return NextResponse.json(
    { success: false, code: "VALIDATION_ERROR", field, message, error: message },
    { status: 400 }
  );
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return validationError("body", "Invalid request.");
    }
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const fullName = str(body.fullName);
    const email = str(body.email).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    const organizationName = str(body.organizationName);
    const rawPhone = str(body.phoneNumber ?? body.phone);

    if (!fullName) return validationError("fullName", "Full name is required.");
    if (!rawPhone) return validationError("phoneNumber", "Phone number is required.");
    if (!email) return validationError("email", "Email address is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return validationError("email", "Enter a valid email address.");
    }
    if (!password) return validationError("password", "Password is required.");

    const phoneValidation = validateAndNormalizePhone(rawPhone);
    if (!phoneValidation.valid) {
      return validationError(
        "phoneNumber",
        phoneValidation.error || "Please enter a valid phone number."
      );
    }

    if (password.length < 6) {
      return validationError("password", "Password must be at least 6 characters long.");
    }

    const orgName = organizationName || `${fullName}'s ISP`;
    const orgSlug = `${slugify(orgName)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const normalizedPhone = phoneValidation.normalizedPhoneNumber;

    const supabaseAdmin = createSupabaseServiceClient();

    // 1. Create Supabase Auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        organization_name: orgName,
        phone_number: normalizedPhone,
        normalized_phone_number: normalizedPhone,
        country_code: phoneValidation.countryCode,
      },
    });

    if (authError || !authData.user) {
      console.error("[Register API] Auth user creation failed:", authError);
      if (authError?.message?.includes("already") || authError?.code === "email_exists") {
        const msg = "An account with this email address already exists.";
        return NextResponse.json(
          { success: false, code: "EMAIL_EXISTS", message: msg, error: msg },
          { status: 409 }
        );
      }
      const friendly = classifyAuthError(authError, "register");
      return NextResponse.json(
        { success: false, code: "REGISTER_FAILED", message: friendly, error: friendly },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // 2. Create organization in DB with normalized phone number
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: orgName,
        slug: orgSlug,
        email,
        phone: normalizedPhone,
        currency: "KES",
        timezone: "Africa/Nairobi",
        billing_cycle_type: "ANNIVERSARY",
        grace_period_days: 2,
        is_active: true,
      })
      .select()
      .single();

    if (orgError || !org) {
      console.error("[Register API] Organization creation failed:", orgError);
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
      return NextResponse.json(
        {
          success: false,
          code: "SIGNUP_FAILED",
          message: "Unable to create the account.",
          error: "Unable to create the account.",
        },
        { status: 500 }
      );
    }

    // 3. Create user profile in DB with normalized phone_number
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        organization_id: org.id,
        full_name: fullName,
        phone_number: normalizedPhone,
        role: "isp_owner",
        is_active: true,
      });

    if (profileError) {
      console.error("[Register API] Profile creation failed:", profileError);
      await supabaseAdmin.from("organizations").delete().eq("id", org.id);
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
      return NextResponse.json(
        {
          success: false,
          code: "SIGNUP_FAILED",
          message: "Unable to create the account.",
          error: "Unable to create the account.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Account and organization registered successfully.",
        user: {
          id: userId,
          email,
          fullName,
          phoneNumber: normalizedPhone,
          countryCode: phoneValidation.countryCode,
          organizationId: org.id,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Register API] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred during registration." },
      { status: 500 }
    );
  }
}


