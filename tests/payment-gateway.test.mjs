import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  buildStkPayload,
  darajaPassword,
  darajaTimestamp,
  initiateDarajaSTKPush,
  oauthUrl,
  parseC2BEvent,
  parseStkResponse,
  registerC2BUrls,
  stkPushUrl,
} from "../src/lib/payments/daraja.ts";
import {
  buildUnmatchedViews,
  gatewayMissingFields,
  mergeGatewaySecrets,
  SECRET_MASK,
  validateGatewayInput,
  verifyWebhookToken,
} from "../src/lib/payments/gateway.ts";

const credentials = {
  environment: "sandbox",
  shortcode: "174379",
  passkey: "test-passkey",
  consumerKey: "key",
  consumerSecret: "secret",
};

test("daraja — URLs, timestamp and password are deterministic", () => {
  assert.equal(oauthUrl("sandbox"), "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials");
  assert.equal(stkPushUrl("production"), "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest");
  assert.equal(darajaTimestamp(new Date(2026, 0, 2, 3, 4, 5)), "20260102030405");

  const expected = createHash("sha256").update("174379test-passkey20260102030405").digest("base64");
  assert.equal(darajaPassword("174379", "test-passkey", "20260102030405"), expected);
});

test("daraja — STK payload carries the real Daraja fields", () => {
  const payload = buildStkPayload(
    credentials,
    {
      phoneNumber: "254712345678",
      amount: 199.5,
      accountReference: "ACC-1234",
      transactionDesc: "Internet bill",
      callbackUrl: "https://isp.example.com/api/v1/mpesa-callback",
    },
    new Date(2026, 0, 2, 3, 4, 5)
  );
  assert.equal(payload.BusinessShortCode, "174379");
  assert.equal(payload.PartyA, "254712345678");
  assert.equal(payload.PartyB, "174379");
  assert.equal(payload.Amount, 199.5);
  assert.equal(payload.TransactionType, "CustomerPayBillOnline");
  assert.equal(payload.Timestamp, "20260102030405");
  assert.equal(payload.AccountReference, "ACC-1234");
  assert.ok(payload.Password.length > 20);
});

test("daraja — OAuth bearer token is used for the STK post", async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, init });
    if (String(url).includes("oauth")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "token-123" }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ResponseCode: "0",
        MerchantRequestID: "MR-1",
        CheckoutRequestID: "ws_CO_1",
        ResponseDescription: "Accepted",
      }),
    };
  };

  const result = await initiateDarajaSTKPush(
    credentials,
    {
      phoneNumber: "254712345678",
      amount: 100,
      accountReference: "ACC-1",
      transactionDesc: "Bill",
      callbackUrl: "https://isp.example.com/api/v1/mpesa-callback",
    },
    fakeFetch,
    new Date(2026, 0, 2, 3, 4, 5)
  );

  assert.equal(result.success, true);
  assert.equal(result.checkoutRequestId, "ws_CO_1");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.headers.Authorization.startsWith("Basic "), true);
  assert.equal(calls[1].init.headers.Authorization, "Bearer token-123");
  assert.equal(JSON.parse(calls[1].init.body).Password.length > 20, true);
});

test("daraja — rejected STK responses raise instead of fabricating success", async () => {
  const fakeFetch = async (url) => {
    if (String(url).includes("oauth")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "token" }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ ResponseCode: "1", ResponseDescription: "Invalid shortcode" }),
    };
  };
  await assert.rejects(
    () =>
      initiateDarajaSTKPush(
        credentials,
        {
          phoneNumber: "254712345678",
          amount: 100,
          accountReference: "ACC-1",
          transactionDesc: "Bill",
          callbackUrl: "https://isp.example.com/callback",
        },
        fakeFetch
      ),
    /Invalid shortcode/
  );
  assert.equal(parseStkResponse({ ResponseCode: "0", CheckoutRequestID: "abc" }).success, true);
});

test("daraja — C2B registration posts both URLs", async () => {
  let body = null;
  const fakeFetch = async (url, init) => {
    if (String(url).includes("oauth")) {
      return { ok: true, status: 200, json: async () => ({ access_token: "token" }) };
    }
    body = JSON.parse(init.body);
    return { ok: true, status: 200, json: async () => ({ ResponseCode: "0", ResponseDescription: "Registered" }) };
  };
  const result = await registerC2BUrls(
    credentials,
    {
      confirmationUrl: "https://isp.example.com/api/v1/mpesa-c2b/confirmation",
      validationUrl: "https://isp.example.com/api/v1/mpesa-c2b/validation",
    },
    fakeFetch
  );
  assert.equal(result.responseCode, "0");
  assert.equal(body.ShortCode, "174379");
  assert.equal(body.ResponseType, "Completed");
  assert.match(body.ConfirmationURL, /confirmation/);
  assert.match(body.ValidationURL, /validation/);
});

test("daraja — C2B payloads normalize M-Pesa field names", () => {
  const event = parseC2BEvent({
    TransID: "RKF123",
    TransAmount: "250.00",
    MSISDN: "254712345678",
    BillRefNumber: "ACC123",
    FirstName: "Gift",
    LastName: "Langat",
    BusinessShortCode: "174379",
  });
  assert.equal(event.transactionReference, "RKF123");
  assert.equal(event.amount, 250);
  assert.equal(event.accountReference, "ACC123");
  assert.equal(event.senderName, "Gift Langat");
  assert.equal(event.shortcode, "174379");
  assert.throws(() => parseC2BEvent({ TransAmount: "0" }), /missing a transaction id/);
});

test("gateway — masks preserve stored secrets and validate input", () => {
  const existing = { consumerKey: "stored-key", consumerSecret: "stored-secret", passkey: "stored-passkey" };
  const merged = mergeGatewaySecrets(existing, {
    consumerKey: SECRET_MASK,
    consumerSecret: "",
    passkey: "new-passkey",
  });
  assert.equal(merged.consumerKey, "stored-key");
  assert.equal(merged.consumerSecret, "stored-secret");
  assert.equal(merged.passkey, "new-passkey");

  const checked = validateGatewayInput({
    environment: "production",
    shortcode: "4084200",
    callbackUrl: "https://isp.example.com/api/v1/mpesa-callback",
    confirmationUrl: "https://isp.example.com/api/v1/mpesa-c2b/confirmation",
    validationUrl: "https://isp.example.com/api/v1/mpesa-c2b/validation",
    isEnabled: true,
  });
  assert.equal(checked.ok, true);
  assert.equal(validateGatewayInput({ ...checked.ok ? checked.value : {}, shortcode: "abc" }).ok, false);
  assert.deepEqual(gatewayMissingFields(null), ["gateway configuration"]);
});

test("gateway — webhook token uses constant-time comparison", () => {
  assert.equal(verifyWebhookToken(undefined, null), true);
  assert.equal(verifyWebhookToken("secret", "secret"), true);
  assert.equal(verifyWebhookToken("secret", "wrong"), false);
  assert.equal(verifyWebhookToken("secret", null), false);
});

test("gateway — unmatched views suggest subscriber but never auto-allocate", () => {
  const views = buildUnmatchedViews(
    [
      {
        id: "pay-1",
        transactionReference: "ws_CO_1",
        providerReceipt: "RKF123",
        amount: 500,
        paymentMethod: "MPESA_C2B",
        msisdnPhone: "0712345678",
        accountReference: "ACC123",
        customerId: null,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ],
    [
      {
        id: "cust-1",
        accountNumber: "ACC123",
        fullName: "Gift Langat",
        phoneNumber: "0712345678",
      },
    ],
    []
  );
  assert.equal(views[0].suggestedCustomerId, "cust-1");
  assert.equal(views[0].matchBy, "ACCOUNT_NUMBER");
  assert.equal(views[0].suggestedInvoiceId, undefined);
});

test("routes — live STK and C2B handlers are wired to real Daraja code", () => {
  const stk = readFileSync(new URL("../src/app/api/v1/mpesa-stk-push/route.ts", import.meta.url), "utf8");
  const callback = readFileSync(new URL("../src/app/api/v1/mpesa-callback/route.ts", import.meta.url), "utf8");
  const confirmation = readFileSync(new URL("../src/app/api/v1/mpesa-c2b/confirmation/route.ts", import.meta.url), "utf8");
  const validation = readFileSync(new URL("../src/app/api/v1/mpesa-c2b/validation/route.ts", import.meta.url), "utf8");
  assert.match(stk, /initiateDarajaSTKPush/);
  assert.match(stk, /recordInitiatedPayment/);
  assert.match(callback, /resolveOrgByCheckoutRequest/);
  assert.match(callback, /providerReceipt/);
  assert.match(confirmation, /resolveOrgByShortcode/);
  assert.match(validation, /parseC2BEvent/);
});
