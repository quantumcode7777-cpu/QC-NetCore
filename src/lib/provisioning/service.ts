// ====================================================================
// QC NETCORE - PROVISIONING SERVICE (server-only)
// Issues bootstrap scripts and registers routers. Uses the service-role
// client, so every query below is explicitly scoped by organization_id
// resolved from the authenticated session - never from the request body.
// ====================================================================

import { createClient } from "@supabase/supabase-js";
import { RouterScriptGenerator } from "@/lib/network/script-generator";
import { hasPermission } from "@/lib/auth/rbac";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";
import {
  ROUTER_API_USER,
  TOKEN_TTL_MS,
  allocateTunnelIp,
  decryptSecret,
  encryptSecret,
  generateApiPassword,
  generateProvisioningToken,
  hashToken,
  loadProvisioningEnv,
  routerOsMajor,
  type BootstrapRequest,
  type ProvisioningEnv,
  type RegistrationPayload,
} from "./core";

export interface ProvisioningError {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export interface Actor {
  userId: string;
  email?: string;
  organizationId: string;
  role: UserRole;
}

const fail = (status: number, code: string, message: string): ProvisioningError => ({
  ok: false,
  status,
  code,
  message,
});

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("[PROJECT_REF]")) return null;
  // Intentionally untyped: router_provisioning_tokens is not in generated types yet.
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

type Db = NonNullable<ReturnType<typeof serviceClient>>;

/** Resolves the authenticated actor and organization from the Supabase session. */
export async function resolveActor(): Promise<{ ok: true; actor: Actor } | ProvisioningError> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("[PROJECT_REF]")) {
    return fail(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable. Please try again.");
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fail(401, "UNAUTHENTICATED", "Please sign in to continue.");

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("organization_id, role, is_active")
      .eq("id", user.id)
      .maybeSingle();
    if (error) {
      console.error("[Provisioning Bootstrap] Profiles lookup failure:", error.code || error.message);
      return fail(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable. Please try again.");
    }
    if (!profile || !profile.organization_id || profile.is_active === false) {
      return fail(403, "FORBIDDEN_ORGANIZATION", "Your account is not linked to an active organization.");
    }
    const role = profile.role as UserRole;
    if (!hasPermission(role, "routers.provision")) {
      return fail(403, "PERMISSION_DENIED", "You don't have permission to provision routers.");
    }
    return {
      ok: true,
      actor: { userId: user.id, email: user.email ?? undefined, organizationId: profile.organization_id, role },
    };
  } catch (err) {
    console.error("[Provisioning Bootstrap] resolveActor unexpected failure:", (err as Error)?.message);
    return fail(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable. Please try again.");
  }
}

async function audit(db: Db, row: { organizationId: string; actorId?: string; actorEmail?: string; action: string; resourceId?: string; metadata?: Record<string, unknown> }) {
  try {
    // Metadata must never contain tokens, passwords, keys or secrets.
    await db.from("audit_log").insert({
      organization_id: row.organizationId,
      actor_id: row.actorId ?? null,
      actor_email: row.actorEmail ?? null,
      action: row.action,
      resource_type: "router_provisioning",
      resource_id: row.resourceId ?? null,
      metadata: row.metadata ?? null,
    });
  } catch {
    /* audit is best-effort and must not break provisioning */
  }
}

export interface BootstrapResult {
  ok: true;
  script: string;
  filename: string;
  expiresAt: string;
  status: "AWAITING_CONNECTION";
  routerName: string;
}

async function usedTunnelIps(db: Db): Promise<string[] | null> {
  const [routers, tokens] = await Promise.all([
    db.from("routers").select("wireguard_tunnel_ip").not("wireguard_tunnel_ip", "is", null),
    db.from("router_provisioning_tokens").select("tunnel_ip").in("status", ["PROVISIONING", "AWAITING_CONNECTION"]),
  ]);
  if (routers.error || tokens.error) {
    if (tokens.error) {
      console.error("[Provisioning Bootstrap] Supabase provisioning-token query failure:", tokens.error.code || tokens.error.message);
    }
    if (routers.error) {
      console.error("[Provisioning Bootstrap] Supabase routers query failure:", routers.error.code || routers.error.message);
    }
    return null;
  }
  return [
    ...(routers.data ?? []).map((r: { wireguard_tunnel_ip: string }) => r.wireguard_tunnel_ip),
    ...(tokens.data ?? []).map((t: { tunnel_ip: string }) => t.tunnel_ip),
  ];
}

export const MAX_ACTIVE_TOKENS_PER_ORG = 5;

export async function issueBootstrap(actor: Actor, req: BootstrapRequest): Promise<BootstrapResult | ProvisioningError> {
  const envResult = loadProvisioningEnv(process.env as Record<string, string | undefined>);
  if (!envResult.ok) {
    // Names only, never values.
    console.error("[Provisioning Bootstrap] Environment configuration failure: missing/invalid:", envResult.missing.join(", "));
    const missingList = envResult.missing.join(", ");
    return fail(
      503,
      "PROVISIONING_NOT_CONFIGURED",
      `Router provisioning is not configured: ${missingList} is missing or invalid.`
    );
  }
  const env: ProvisioningEnv = envResult.config;
  const db = serviceClient();
  if (!db) {
    console.error("[Provisioning Bootstrap] Supabase service-role client unavailable");
    return fail(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable. Please try again.");
  }

  try {
    let routerName = req.routerName ?? "";
    let version = req.routerOsVersion;
    let existingTunnelIp: string | null = null;
    let siteId = req.siteId ?? null;

    if (req.routerId) {
      const { data: router, error } = await db
        .from("routers")
        .select("id, organization_id, name, routeros_version, wireguard_tunnel_ip, site_id")
        .eq("id", req.routerId)
        .eq("organization_id", actor.organizationId)
        .maybeSingle();
      if (error) return fail(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable. Please try again.");
      // Same answer for "not found" and "other organization": no existence leak.
      if (!router) return fail(403, "FORBIDDEN_ORGANIZATION", "That router is not available in your organization.");
      routerName = router.name;
      version = routerOsMajor(router.routeros_version);
      existingTunnelIp = router.wireguard_tunnel_ip ?? null;
      siteId = router.site_id ?? null;

      // Revoke any existing pending tokens for this specific router
      await db
        .from("router_provisioning_tokens")
        .update({ status: "REVOKED" })
        .eq("router_id", req.routerId)
        .eq("organization_id", actor.organizationId)
        .in("status", ["PROVISIONING", "AWAITING_CONNECTION"]);
    } else if (siteId) {
      const { data: site } = await db.from("sites").select("id").eq("id", siteId).eq("organization_id", actor.organizationId).maybeSingle();
      if (!site) return fail(403, "FORBIDDEN_ORGANIZATION", "That site is not available in your organization.");
    }

    const { data: org } = await db.from("organizations").select("name, slug").eq("id", actor.organizationId).maybeSingle();

    // Expire this organization's stale tokens (housekeeping; validity is also checked on use).
    await db
      .from("router_provisioning_tokens")
      .update({ status: "EXPIRED" })
      .eq("organization_id", actor.organizationId)
      .in("status", ["PROVISIONING", "AWAITING_CONNECTION"])
      .lt("expires_at", new Date().toISOString());

    // Enforce active provisioning tokens limit per organization
    const { count: activeCount } = await db
      .from("router_provisioning_tokens")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", actor.organizationId)
      .in("status", ["PROVISIONING", "AWAITING_CONNECTION"]);

    if ((activeCount ?? 0) >= MAX_ACTIVE_TOKENS_PER_ORG) {
      return fail(
        429,
        "TOO_MANY_ACTIVE_TOKENS",
        `You have reached the maximum of ${MAX_ACTIVE_TOKENS_PER_ORG} active provisioning tokens. Please wait for an existing token to complete registration or expire.`
      );
    }

    const { token, tokenHash } = generateProvisioningToken();
    const apiPassword = generateApiPassword();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    let tokenId: string | null = null;
    let tunnelIp = existingTunnelIp ?? "";
    for (let attempt = 0; attempt < 5 && !tokenId; attempt++) {
      if (!existingTunnelIp) {
        const used = await usedTunnelIps(db);
        if (!used) return fail(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable. Please try again.");
        const ip = allocateTunnelIp(used, attempt);
        if (!ip) return fail(503, "TUNNEL_POOL_EXHAUSTED", "No management tunnel addresses are available.");
        tunnelIp = ip;
      }
      const { data, error } = await db
        .from("router_provisioning_tokens")
        .insert({
          organization_id: actor.organizationId,
          created_by: actor.userId,
          router_id: req.routerId ?? null,
          site_id: siteId,
          router_name: routerName,
          routeros_version: version,
          tunnel_ip: tunnelIp,
          token_hash: tokenHash,
          api_password_encrypted: encryptSecret(apiPassword, env.encryptionKey),
          status: "PROVISIONING",
          expires_at: expiresAt,
        })
        .select("id")
        .single();
      if (!error && data) tokenId = data.id;
      else if (error?.code !== "23505" || existingTunnelIp) {
        console.error("[Provisioning Bootstrap] Supabase provisioning-token insert failure:", error?.code || error?.message);
        return fail(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable. Please try again.");
      }
    }
    if (!tokenId) {
      console.error("[Provisioning Bootstrap] Failed to allocate token after max attempts");
      return fail(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable. Please try again.");
    }

    let script: string;
    try {
      script = RouterScriptGenerator.generateScript({
        routerName,
        orgName: org?.name ?? "Organization",
        orgSlug: org?.slug ?? "",
        orgId: actor.organizationId,
        routerOsVersion: version,
        managementTunnelIp: tunnelIp,
        saasGatewayHost: env.gatewayHost,
        saasGatewayPort: env.gatewayPort,
        saasPublicKey: env.gatewayPublicKey,
        radiusSecret: env.radiusSecret,
        radiusServerAddress: env.radiusServer,
        radiusAuthPort: env.radiusAuthPort,
        radiusAcctPort: env.radiusAcctPort,
        hotspotDnsName: env.hotspotDnsName,
        portalDomain: env.portalDomain,
        registration: { url: `${env.baseUrl}/api/v1/mikrotik-provisioning/register`, token },
        apiUser: { name: ROUTER_API_USER, password: apiPassword },
      });
    } catch (err) {
      await db.from("router_provisioning_tokens").update({ status: "REVOKED" }).eq("id", tokenId);
      console.error("[Provisioning Bootstrap] Script generation failure:", (err as Error)?.message);
      return fail(422, "SCRIPT_GENERATION_FAILED", "The provisioning script could not be generated. Check the router details and try again.");
    }

    await db.from("router_provisioning_tokens").update({ status: "AWAITING_CONNECTION" }).eq("id", tokenId);
    await audit(db, {
      organizationId: actor.organizationId,
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "router.provision.issue",
      resourceId: tokenId,
      metadata: { routerName, routerOsVersion: version, existingRouter: Boolean(req.routerId), expiresAt },
    });

    const safeName = routerName.replace(/[^A-Za-z0-9._-]+/g, "-");
    return { ok: true, script, filename: `qc-netcore-${safeName}.rsc`, expiresAt, status: "AWAITING_CONNECTION", routerName };
  } catch (err) {
    console.error("[Provisioning Bootstrap] issueBootstrap unexpected failure:", (err as Error)?.message);
    return fail(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable. Please try again.");
  }
}

/** Called by the router itself (token-authenticated, no session). Consumes the token atomically. */
export async function registerRouter(
  payload: RegistrationPayload,
  sourceIp: string | null
): Promise<{ ok: true; routerId: string } | ProvisioningError> {
  const envResult = loadProvisioningEnv(process.env as Record<string, string | undefined>);
  if (!envResult.ok) return fail(503, "PROVISIONING_NOT_CONFIGURED", "Router provisioning is not configured on this server.");
  const db = serviceClient();
  if (!db) return fail(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable.");
  const { encryptionKey } = envResult.config;

  try {
    const nowIso = new Date().toISOString();
    // Atomic single-use consumption: only one caller can flip AWAITING_CONNECTION -> CONNECTED.
    const { data: tok, error } = await db
      .from("router_provisioning_tokens")
      .update({ status: "CONNECTED", consumed_at: nowIso })
      .eq("token_hash", hashToken(payload.token))
      .eq("status", "AWAITING_CONNECTION")
      .gt("expires_at", nowIso)
      .select("*")
      .maybeSingle();
    if (error) return fail(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable.");
    if (!tok) return fail(401, "TOKEN_INVALID_OR_EXPIRED", "This provisioning token is invalid, expired or already used. Generate a new script.");

    const revert = () => db.from("router_provisioning_tokens").update({ status: "AWAITING_CONNECTION", consumed_at: null }).eq("id", tok.id);

    const isV7 = tok.routeros_version === "v7";
    if (isV7 && !payload.publicKey) {
      await revert();
      return fail(422, "PUBLIC_KEY_REQUIRED", "The router did not report its WireGuard public key.");
    }
    if (!isV7 && !sourceIp) {
      await revert();
      return fail(422, "SOURCE_ADDRESS_UNKNOWN", "Could not determine the router's address.");
    }

    // New routers must initially be registered as OFFLINE; real live link/telemetry
    // determines ONLINE status later.
    const fields = {
      management_ip: isV7 ? tok.tunnel_ip : (sourceIp as string),
      api_port: 8728,
      api_ssl_port: 8729,
      username: ROUTER_API_USER,
      password_encrypted: tok.api_password_encrypted,
      routeros_version: payload.routerosVersion,
      board_model: payload.boardModel,
      cpu_load: payload.cpuLoad,
      free_memory_mb: payload.freeMemoryMb,
      uptime: payload.uptime,
      connection_type: isV7 ? "WIREGUARD" : "DIRECT_PUBLIC",
      wireguard_public_key: payload.publicKey ?? null,
      wireguard_tunnel_ip: isV7 ? tok.tunnel_ip : null,
      radius_secret_encrypted: encryptSecret(envResult.config.radiusSecret, encryptionKey),
      status: "OFFLINE",
      last_seen_at: nowIso,
      updated_at: nowIso,
    };

    let routerId: string | null = null;
    if (tok.router_id) {
      const { data, error: upErr } = await db
        .from("routers")
        .update(fields)
        .eq("id", tok.router_id)
        .eq("organization_id", tok.organization_id)
        .select("id")
        .maybeSingle();
      if (upErr || !data) { await revert(); return fail(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable."); }
      routerId = data.id;
    } else {
      const { data, error: insErr } = await db
        .from("routers")
        .insert({ ...fields, organization_id: tok.organization_id, site_id: tok.site_id, name: tok.router_name })
        .select("id")
        .single();
      if (insErr || !data) {
        console.error("[provisioning] router insert failed:", insErr?.code);
        await revert();
        return fail(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable.");
      }
      routerId = data.id;
    }

    await audit(db, {
      organizationId: tok.organization_id,
      action: "router.provision.register",
      resourceId: routerId as string,
      metadata: { routerName: tok.router_name, routerOsVersion: payload.routerosVersion },
    });
    return { ok: true, routerId: routerId as string };
  } catch (err) {
    console.error("[provisioning] registerRouter failed:", (err as Error)?.message);
    return fail(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable.");
  }
}

export { decryptSecret };
