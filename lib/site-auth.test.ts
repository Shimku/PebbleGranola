import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clearLoginFailures,
  isSameOrigin,
  isValidSession,
  loginAllowed,
  recordLoginFailure,
  requireDashboard,
  sessionTokenFor,
} from "./site-auth.ts";
import { resolvePebbleToken, timingSafeEqual } from "./secret.ts";

test("session token is stable for a password and rejects another", () => {
  const token = sessionTokenFor("correct-horse-battery");
  assert.equal(isValidSession("correct-horse-battery", token), true);
  assert.equal(isValidSession("other-horse-battery", token), false);
  assert.equal(isValidSession("correct-horse-battery", "nope"), false);
});

test("timingSafeEqual rejects different lengths without throwing", () => {
  assert.equal(timingSafeEqual("abc", "ab"), false);
  assert.equal(timingSafeEqual("same", "same"), true);
});

test("env pebble token wins over a stored token", () => {
  const resolved = resolvePebbleToken("old-token-from-db-value", "new-env-token-value-ok", () => {
    throw new Error("should not generate");
  });
  assert.equal(resolved.token, "new-env-token-value-ok");
  assert.equal(resolved.persist, true);
});

test("stored pebble token is kept when env is empty", () => {
  const resolved = resolvePebbleToken("stored-token-value-ok", null, () => {
    throw new Error("should not generate");
  });
  assert.equal(resolved.token, "stored-token-value-ok");
  assert.equal(resolved.persist, false);
});

test("same-origin fetch is accepted", () => {
  const request = new Request("https://pebble-granola.vercel.app/api/status", {
    headers: { origin: "https://pebble-granola.vercel.app" },
  });
  assert.equal(isSameOrigin(request), true);
});

test("cross-origin POST is rejected", () => {
  const request = new Request("https://pebble-granola.vercel.app/api/status", {
    headers: { origin: "https://evil.example" },
  });
  assert.equal(isSameOrigin(request), false);
});

test("sec-fetch-site same-origin is enough without Origin", () => {
  const request = new Request("https://pebble-granola.vercel.app/api/status", {
    headers: { "sec-fetch-site": "same-origin" },
  });
  assert.equal(isSameOrigin(request), true);
});

test("login rate limit trips after too many failures", () => {
  const ip = `test-${Date.now()}`;
  clearLoginFailures(ip);
  for (let i = 0; i < 8; i += 1) {
    assert.equal(loginAllowed(ip), true);
    recordLoginFailure(ip);
  }
  assert.equal(loginAllowed(ip), false);
  clearLoginFailures(ip);
  assert.equal(loginAllowed(ip), true);
});

test("requireDashboard is 503 when SITE_PASSWORD is missing", () => {
  const prev = process.env.SITE_PASSWORD;
  delete process.env.SITE_PASSWORD;
  try {
    const blocked = requireDashboard(
      new Request("https://pebble-granola.vercel.app/api/status"),
    );
    assert.equal(blocked?.status, 503);
  } finally {
    if (prev === undefined) delete process.env.SITE_PASSWORD;
    else process.env.SITE_PASSWORD = prev;
  }
});

test("requireDashboard is 401 without a session cookie", () => {
  const prev = process.env.SITE_PASSWORD;
  process.env.SITE_PASSWORD = "abcdefgh";
  try {
    const blocked = requireDashboard(
      new Request("https://pebble-granola.vercel.app/api/status"),
    );
    assert.equal(blocked?.status, 401);
    const cookie = sessionTokenFor("abcdefgh");
    const allowed = requireDashboard(
      new Request("https://pebble-granola.vercel.app/api/status", {
        headers: { cookie: `pg_session=${cookie}` },
      }),
    );
    assert.equal(allowed, null);
  } finally {
    if (prev === undefined) delete process.env.SITE_PASSWORD;
    else process.env.SITE_PASSWORD = prev;
  }
});
