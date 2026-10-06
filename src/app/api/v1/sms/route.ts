import { NextRequest, NextResponse } from "next/server";
import { loadLiveOrDemoCopilotEnvironment } from "@/lib/ai/live-data-loader";
import { hasPermission } from "@/lib/auth/rbac";
import {
  getOrCreateTenantSmsState,
  sanitizeProviderConfigForClient,
  buildEnrichedSmsRecipients,
  getSmsOverviewMetrics,
  getSmsHistory,
  previewSmsCampaign,
  dispatchSmsCampaign,
  saveSmsTemplate,
  updateCustomerSmsPreferences,
  updateTenantSmsProviderConfig,
  type SmsRecipientMode,
  type SmsCategory,
  type SmsMessageType,
  type SmsTargetFilters,
  type SmsDeliveryStatus,
  type SmsProviderType,
  type SmsEnvironmentType,
  type SmsTenantOperationalData,
} from "@/lib/sms/engine";

export const dynamic = "force-dynamic";

function datasetToSmsOperationalData(
  env: Awaited<ReturnType<typeof loadLiveOrDemoCopilotEnvironment>>
): SmsTenantOperationalData {
  return {
    organization: env.dataset.organization,
    customers: env.dataset.customers,
    pppoeAccounts: env.dataset.pppoeAccounts,
    subscriptions: env.dataset.subscriptions,
    plans: env.dataset.plans,
    routers: env.dataset.routers,
    sites: env.dataset.sites,
    payments: env.dataset.payments,
    invoices: env.dataset.invoices,
  };
}

export async function GET(req: NextRequest) {
  try {
    const env = await loadLiveOrDemoCopilotEnvironment();
    const { ctx } = env;

    if (!hasPermission(ctx.userRole, "sms.view")) {
      return NextResponse.json(
        {
          success: false,
          code: "PERMISSION_DENIED",
          message: "You don't have permission to view SMS communications.",
        },
        { status: 403 }
      );
    }

    const isDemo = ctx.environmentMode === "DEMO_DATA";
    const opData = datasetToSmsOperationalData(env);
    const state = getOrCreateTenantSmsState(ctx.organizationId, isDemo);

    const url = new URL(req.url);
    const search = url.searchParams.get("search") || undefined;
    const status = (url.searchParams.get("status") as SmsDeliveryStatus | "ALL") || "ALL";
    const messageType =
      (url.searchParams.get("messageType") as SmsMessageType | "ALL") || "ALL";
    const provider =
      (url.searchParams.get("provider") as SmsProviderType | "ALL") || "ALL";
    const dateFrom = url.searchParams.get("dateFrom") || undefined;
    const dateTo = url.searchParams.get("dateTo") || undefined;

    const overview = getSmsOverviewMetrics(ctx.organizationId, opData, isDemo);
    const providerSummary = sanitizeProviderConfigForClient(state.providerConfig);
    const recipients = buildEnrichedSmsRecipients(ctx.organizationId, opData);
    const history = hasPermission(ctx.userRole, "sms.view_history")
      ? getSmsHistory(
          ctx.organizationId,
          { search, status, messageType, provider, dateFrom, dateTo },
          isDemo
        )
      : [];

    return NextResponse.json({
      success: true,
      data: {
        organizationId: ctx.organizationId,
        organizationName: ctx.organizationName,
        userRole: ctx.userRole,
        environmentMode: ctx.environmentMode,
        permissions: {
          canSend: hasPermission(ctx.userRole, "sms.send"),
          canSendBulk: hasPermission(ctx.userRole, "sms.send_bulk"),
          canManageTemplates: hasPermission(ctx.userRole, "sms.manage_templates"),
          canManageProvider: hasPermission(ctx.userRole, "sms.manage_provider"),
          canViewHistory: hasPermission(ctx.userRole, "sms.view_history"),
          canViewUsage: hasPermission(ctx.userRole, "sms.view_usage"),
        },
        overview,
        provider: providerSummary,
        recipients,
        templates: state.templates,
        campaigns: state.campaigns,
        history,
        auditLogs: state.auditLogs.slice(0, 50),
        plans: opData.plans,
        sites: opData.sites,
        routers: opData.routers,
      },
    });
  } catch (err) {
    console.error("[SMS API GET] Error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Unable to load SMS communications data.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action || "SEND").toUpperCase();

    const env = await loadLiveOrDemoCopilotEnvironment({
      userRoleOverride:
        typeof body.roleOverride === "string"
          ? (body.roleOverride as typeof env.ctx.userRole)
          : undefined,
    });
    const { ctx } = env;
    const isDemo = ctx.environmentMode === "DEMO_DATA";
    const opData = datasetToSmsOperationalData(env);

    if (action === "PREVIEW") {
      if (!hasPermission(ctx.userRole, "sms.view")) {
        return NextResponse.json(
          { success: false, message: "Permission denied." },
          { status: 403 }
        );
      }
      const preview = previewSmsCampaign({
        organizationId: ctx.organizationId,
        recipientMode:
          (body.recipientMode as SmsRecipientMode) || "INDIVIDUAL",
        category: (body.category as SmsCategory) || "TRANSACTIONAL",
        messageTemplate: String(body.messageTemplate || ""),
        filters: (body.filters as SmsTargetFilters) || {},
        data: opData,
        isDemoMode: isDemo,
      });

      return NextResponse.json({
        success: preview.ok,
        message: preview.error,
        data: preview,
      });
    }

    if (action === "SEND") {
      const result = dispatchSmsCampaign({
        organizationId: ctx.organizationId,
        actorName:
          typeof body.actorName === "string"
            ? body.actorName
            : `${ctx.organizationName} Operator`,
        actorRole: ctx.userRole,
        campaignName:
          typeof body.campaignName === "string" ? body.campaignName : undefined,
        recipientMode:
          (body.recipientMode as SmsRecipientMode) || "INDIVIDUAL",
        messageType:
          (body.messageType as SmsMessageType) || "INDIVIDUAL",
        category: (body.category as SmsCategory) || "TRANSACTIONAL",
        templateCode:
          typeof body.templateCode === "string" ? body.templateCode : undefined,
        messageTemplate: String(body.messageTemplate || ""),
        filters: (body.filters as SmsTargetFilters) || {},
        confirmed: Boolean(body.confirmed),
        idempotencyKey:
          typeof body.idempotencyKey === "string"
            ? body.idempotencyKey
            : undefined,
        scheduledAt:
          typeof body.scheduledAt === "string" ? body.scheduledAt : undefined,
        data: opData,
        isDemoMode: isDemo,
      });

      if (!result.ok) {
        const status =
          result.code === "PERMISSION_DENIED"
            ? 403
            : result.code === "DUPLICATE_CAMPAIGN"
            ? 409
            : 400;
        return NextResponse.json(
          {
            success: false,
            code: result.code,
            message: result.error,
            error: result.error,
            preview: result.preview,
          },
          { status }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Dispatched SMS to ${result.messagesDispatched?.length ?? 0} recipient(s).`,
        data: {
          campaign: result.campaign,
          messagesDispatched: result.messagesDispatched,
          overview: getSmsOverviewMetrics(ctx.organizationId, opData, isDemo),
        },
      });
    }

    if (action === "SAVE_TEMPLATE") {
      const tplRes = saveSmsTemplate({
        organizationId: ctx.organizationId,
        actorRole: ctx.userRole,
        id: typeof body.id === "string" ? body.id : undefined,
        code: String(body.code || ""),
        name: String(body.name || ""),
        category: (body.category as SmsCategory) || "TRANSACTIONAL",
        triggerEvent: String(body.triggerEvent || "manual.campaign"),
        bodyTemplate: String(body.bodyTemplate || ""),
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
      });

      if (!tplRes.ok) {
        return NextResponse.json(
          {
            success: false,
            message: tplRes.error,
            error: tplRes.error,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "SMS template saved.",
        data: tplRes.template,
      });
    }

    if (action === "UPDATE_PREFERENCES") {
      if (!hasPermission(ctx.userRole, "customers.update") && !hasPermission(ctx.userRole, "sms.send")) {
        return NextResponse.json(
          { success: false, message: "Permission denied." },
          { status: 403 }
        );
      }
      const customerId = String(body.customerId || "");
      const marketingSms = Boolean(body.marketingSms);
      const updated = updateCustomerSmsPreferences({
        organizationId: ctx.organizationId,
        customerId,
        marketingSms,
      });
      return NextResponse.json({
        success: true,
        message: "Customer communication preferences updated.",
        data: updated,
      });
    }

    if (action === "CONFIGURE_PROVIDER") {
      const cfgRes = updateTenantSmsProviderConfig({
        organizationId: ctx.organizationId,
        actorRole: ctx.userRole,
        actorName: `${ctx.organizationName} Administrator`,
        provider: (body.provider as SmsProviderType) || "AFRICAS_TALKING",
        senderId: typeof body.senderId === "string" ? body.senderId : undefined,
        username: typeof body.username === "string" ? body.username : undefined,
        accountSid:
          typeof body.accountSid === "string" ? body.accountSid : undefined,
        apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
        apiSecret:
          typeof body.apiSecret === "string" ? body.apiSecret : undefined,
        webhookSecret:
          typeof body.webhookSecret === "string"
            ? body.webhookSecret
            : undefined,
        webhookUrl:
          typeof body.webhookUrl === "string" ? body.webhookUrl : undefined,
        environment:
          (body.environment as SmsEnvironmentType) || "PRODUCTION",
        isEnabled:
          body.isEnabled !== undefined ? Boolean(body.isEnabled) : true,
        costPerSegment:
          body.costPerSegment !== undefined && body.costPerSegment !== null
            ? Number(body.costPerSegment)
            : undefined,
      });

      if (!cfgRes.ok) {
        return NextResponse.json(
          {
            success: false,
            message: cfgRes.error,
            error: cfgRes.error,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "SMS gateway configuration updated.",
        data: cfgRes.config,
      });
    }

    return NextResponse.json(
      { success: false, message: "Unsupported SMS action." },
      { status: 400 }
    );
  } catch (err) {
    console.error("[SMS API POST] Error:", err);
    return NextResponse.json(
      {
        success: false,
        message: "Unable to process SMS request right now.",
      },
      { status: 500 }
    );
  }
}
