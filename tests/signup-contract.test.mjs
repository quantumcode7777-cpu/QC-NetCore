import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const route = read("src/app/api/v1/signup/route.ts");
const pages = ["src/app/sign-in/page.tsx", "src/app/register/page.tsx"];

test("every signup form collects and sends phoneNumber", () => {
  for (const p of pages) {
    const src = read(p);
    assert.match(src, /type="tel"/, `${p} must render a phone input`);
    assert.match(src, /phoneNumber:\s*phoneCheck\.normalizedPhoneNumber/, `${p} must send phoneNumber`);
    assert.match(src, /validateAndNormalizePhone/, `${p} must validate phone client-side`);
  }
});

test("signup route validates each field with a field-specific message", () => {
  for (const f of ["fullName", "phoneNumber", "email", "password"]) {
    assert.match(route, new RegExp(`validationError\\("${f}"`), `missing ${f} validation`);
  }
  assert.match(route, /Enter a valid email address\./);
  assert.match(route, /validateAndNormalizePhone/);
});

test("signup route rolls back and returns safe error on failure", () => {
  assert.match(route, /auth\.admin\.deleteUser/);
  assert.match(route, /SIGNUP_FAILED/);
  assert.match(route, /EMAIL_EXISTS/);
  assert.doesNotMatch(route, /console\.(log|error)\([^)]*password/i);
});

test("service-role client is never imported by client code", () => {
  for (const p of pages) {
    assert.doesNotMatch(read(p), /createSupabaseServiceClient|SERVICE_ROLE/);
  }
});
