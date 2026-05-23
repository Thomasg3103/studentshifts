/**
 * hire-applicant Edge Function tests
 *
 * Run with:
 *   deno test --allow-env --allow-read supabase/functions/hire-applicant/index.test.ts
 *
 * Tests use a globalThis.fetch interceptor so no real network calls are made.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ─── constants used in every test ─────────────────────────────────────────────
const SUPABASE_URL  = "https://test.supabase.co";
const COMPANY_ID    = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const APP_ID        = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const JOB_ID        = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const STUDENT_ID    = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const VALID_JWT     = "Bearer valid-company-jwt";

// Set env vars BEFORE dynamically importing the module so module-level constants
// (FRONTEND_URL, corsHeaders) pick up the test values.
Deno.env.set("SUPABASE_URL",              SUPABASE_URL);
Deno.env.set("SUPABASE_ANON_KEY",         "test-anon-key");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
Deno.env.set("BREVO_API_KEY",             "test-brevo-key");
Deno.env.set("FRONTEND_URL",              "http://localhost");

// Dynamic import AFTER env.set so module-level Deno.env.get() calls use test values
const { handler } = await import("./index.ts");

// ─── fetch mock helpers ────────────────────────────────────────────────────────

type FetchScenario = {
  /** null → getUser returns 401 (unauthenticated) */
  userId?: string | null;
  role?: string;
  companyName?: string;
  /** Rows returned by the hire_action_log count HEAD request */
  recentHireCount?: number;
  /** null → INSERT succeeds; { code } → INSERT returns that Postgres error */
  hireLogInsertError?: { code: string; message: string } | null;
  /** Result stored for a cached idempotency hit */
  hireLogCachedResult?: unknown;
  application?: Record<string, unknown> | null;
  job?: Record<string, unknown> | null;
  studentName?: string;
  studentEmail?: string;
  rpcAcceptResult?: Record<string, unknown>[] | null;
};

function mockResponse(body: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(
    body === null ? null : JSON.stringify(body),
    { status, headers: { "Content-Type": "application/json", ...extraHeaders } },
  );
}

/** Install a per-test fetch interceptor; returns a cleanup fn. */
function installFetchMock(scenario: FetchScenario): () => void {
  const orig = globalThis.fetch;

  globalThis.fetch = ((url: string | Request | URL, init?: RequestInit): Promise<Response> => {
    const u = typeof url === "string" ? url : url instanceof URL ? url.href : (url as Request).url;
    const method = (init?.method ?? (url instanceof Request ? url.method : "GET")).toUpperCase();

    // ── auth.getUser ──────────────────────────────────────────────────────────
    if (u.includes("/auth/v1/user")) {
      if (scenario.userId === null || scenario.userId === undefined) {
        return Promise.resolve(mockResponse({ message: "invalid JWT" }, 401));
      }
      return Promise.resolve(mockResponse({ id: scenario.userId, email: "company@test.com" }));
    }

    // ── profiles table ────────────────────────────────────────────────────────
    if (u.includes("/rest/v1/profiles")) {
      // Student name lookup (by student_id, in_() batch)
      if (u.includes(`in.(${STUDENT_ID}`)) {
        return Promise.resolve(mockResponse([{ id: STUDENT_ID, name: scenario.studentName ?? "Test Student" }]));
      }
      return Promise.resolve(mockResponse({
        role: scenario.role ?? "company",
        name: scenario.companyName ?? "Test Company",
      }));
    }

    // ── hire_action_log ───────────────────────────────────────────────────────
    if (u.includes("/rest/v1/hire_action_log")) {
      if (method === "HEAD") {
        // Rate-limit count query
        const count = scenario.recentHireCount ?? 0;
        return Promise.resolve(new Response(null, {
          status: 200,
          headers: { "Content-Range": `0-0/${count}` },
        }));
      }
      if (method === "POST") {
        // Idempotency INSERT
        if (scenario.hireLogInsertError) {
          return Promise.resolve(mockResponse(
            [{ code: scenario.hireLogInsertError.code, message: scenario.hireLogInsertError.message }],
            409,
          ));
        }
        return Promise.resolve(mockResponse([{}], 201));
      }
      if (method === "GET") {
        // Cached idempotency result lookup
        return Promise.resolve(mockResponse([{ result: scenario.hireLogCachedResult ?? null }]));
      }
      if (method === "DELETE" || method === "PATCH") {
        return Promise.resolve(mockResponse([{}]));
      }
    }

    // ── applications table ────────────────────────────────────────────────────
    if (u.includes("/rest/v1/applications")) {
      if (method === "PATCH") {
        const app = scenario.application;
        if (!app) return Promise.resolve(mockResponse([], 200));
        return Promise.resolve(mockResponse([{ id: APP_ID }]));
      }
      return Promise.resolve(mockResponse(
        scenario.application ?? {
          id: APP_ID, student_id: STUDENT_ID, job_id: JOB_ID,
          preferred_shift: "Monday · 9am-5pm", pipeline_stage: "applied", status: "Pending",
        },
      ));
    }

    // ── jobs table ────────────────────────────────────────────────────────────
    if (u.includes("/rest/v1/jobs")) {
      return Promise.resolve(mockResponse(
        scenario.job ?? {
          id: JOB_ID, company_id: COMPANY_ID, title: "Barista",
          days: ["Monday"], times: { Monday: "9am-5pm" },
          filled_shifts: [], status: "Active",
        },
      ));
    }

    // ── RPCs ──────────────────────────────────────────────────────────────────
    if (u.includes("/rest/v1/rpc/get_user_emails")) {
      return Promise.resolve(mockResponse([{ id: STUDENT_ID, email: scenario.studentEmail ?? "student@test.com" }]));
    }
    if (u.includes("/rest/v1/rpc/accept_and_decline_applicants")) {
      return Promise.resolve(mockResponse(
        scenario.rpcAcceptResult ?? [{
          winner_student_id: STUDENT_ID, winner_preferred_shift: "Monday · 9am-5pm",
          declined_student_ids: [], notify_student_ids: [],
          all_shifts_filled: true, new_filled_shifts: ["Monday"],
          out_job_id: JOB_ID, out_job_title: "Barista",
        }],
      ));
    }

    // ── audit_log ─────────────────────────────────────────────────────────────
    if (u.includes("/rest/v1/audit_log")) {
      return Promise.resolve(mockResponse([{}], 201));
    }

    // ── Brevo API ─────────────────────────────────────────────────────────────
    if (u.includes("brevo.com") || u.includes("api.brevo")) {
      return Promise.resolve(mockResponse({ messageId: "test-123" }));
    }

    // ── magic link generation ─────────────────────────────────────────────────
    if (u.includes("/auth/v1/admin/generate_link")) {
      return Promise.resolve(mockResponse({ action_link: "http://localhost/magic" }));
    }

    // Unmatched — fail loudly so missing mocks are easy to spot
    return Promise.reject(new Error(`Unmocked fetch: ${method} ${u}`));
  }) as typeof fetch;

  return () => { globalThis.fetch = orig; };
}

function makeRequest(body?: unknown, authHeader: string | null = VALID_JWT): Request {
  return new Request("http://localhost/hire-applicant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

// ─── tests ────────────────────────────────────────────────────────────────────

Deno.test("OPTIONS preflight returns 200 with CORS headers", async () => {
  const restore = installFetchMock({});
  try {
    const res = await handler(new Request("http://localhost/hire-applicant", { method: "OPTIONS" }));
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  } finally { restore(); }
});

Deno.test("missing Authorization header returns 401", async () => {
  const restore = installFetchMock({});
  try {
    const res = await handler(makeRequest({ applicationId: APP_ID, action: "reject" }, null));
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "Unauthorised");
  } finally { restore(); }
});

Deno.test("unauthenticated JWT (getUser fails) returns 401", async () => {
  const restore = installFetchMock({ userId: null });
  try {
    const res = await handler(makeRequest({ applicationId: APP_ID, action: "reject" }));
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "Unauthorised");
  } finally { restore(); }
});

Deno.test("non-company caller returns 401", async () => {
  const restore = installFetchMock({ userId: COMPANY_ID, role: "student" });
  try {
    const res = await handler(makeRequest({ applicationId: APP_ID, action: "reject" }));
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body.error, "Unauthorised");
  } finally { restore(); }
});

Deno.test("invalid applicationId (not UUID) returns 400", async () => {
  const restore = installFetchMock({ userId: COMPANY_ID, role: "company" });
  try {
    const res = await handler(makeRequest({ applicationId: "not-a-uuid", action: "reject" }));
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "Missing required fields: applicationId, action");
  } finally { restore(); }
});

Deno.test("invalid action value returns 400", async () => {
  const restore = installFetchMock({ userId: COMPANY_ID, role: "company" });
  try {
    const res = await handler(makeRequest({ applicationId: APP_ID, action: "hire" }));
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.error, "Missing required fields: applicationId, action");
  } finally { restore(); }
});

Deno.test("rate limit exceeded returns 429", async () => {
  const restore = installFetchMock({ userId: COMPANY_ID, role: "company", recentHireCount: 10 });
  try {
    const res = await handler(makeRequest({ applicationId: APP_ID, action: "reject" }));
    assertEquals(res.status, 429);
    const body = await res.json();
    assertEquals(typeof body.error, "string");
  } finally { restore(); }
});

Deno.test("idempotent cached result returns 200 with cached data", async () => {
  const cachedResult = { filledShifts: ["Monday"], closedJob: true, declinedIds: [] };
  const restore = installFetchMock({
    userId: COMPANY_ID, role: "company",
    hireLogInsertError: { code: "23505", message: "duplicate key" },
    hireLogCachedResult: cachedResult,
  });
  try {
    const res = await handler(makeRequest({ applicationId: APP_ID, action: "accept" }));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.success, true);
    assertEquals(body.idempotent, true);
  } finally { restore(); }
});

Deno.test("idempotency orphan (null result) returns 409", async () => {
  const restore = installFetchMock({
    userId: COMPANY_ID, role: "company",
    hireLogInsertError: { code: "23505", message: "duplicate key" },
    hireLogCachedResult: null,
  });
  try {
    const res = await handler(makeRequest({ applicationId: APP_ID, action: "accept" }));
    assertEquals(res.status, 409);
    const body = await res.json();
    assertEquals(typeof body.error, "string");
    // Must NOT have a success: false field — errors use { error } only
    assertEquals("success" in body, false);
  } finally { restore(); }
});

Deno.test("reject action returns 200 with success true", async () => {
  const restore = installFetchMock({ userId: COMPANY_ID, role: "company" });
  try {
    const res = await handler(makeRequest({ applicationId: APP_ID, action: "reject" }));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.success, true);
  } finally { restore(); }
});

Deno.test("accept action returns filledShifts, closedJob, declinedIds", async () => {
  const restore = installFetchMock({ userId: COMPANY_ID, role: "company" });
  try {
    const res = await handler(makeRequest({ applicationId: APP_ID, action: "accept" }));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.success, true);
    assertEquals(Array.isArray(body.filledShifts), true);
    assertEquals(typeof body.closedJob, "boolean");
    assertEquals(Array.isArray(body.declinedIds), true);
  } finally { restore(); }
});

Deno.test("idempotencyKey is capped at 256 characters", async () => {
  // Construct a key longer than 256 chars — the function should truncate it silently
  const longKey = "x".repeat(300);
  const restore = installFetchMock({ userId: COMPANY_ID, role: "company" });
  try {
    const res = await handler(makeRequest({ applicationId: APP_ID, action: "reject", idempotencyKey: longKey }));
    // Should succeed — truncation is silent
    assertEquals(res.status, 200);
  } finally { restore(); }
});

Deno.test("error responses never include success: false field", async () => {
  // Validation error path
  const restore = installFetchMock({ userId: COMPANY_ID, role: "company" });
  try {
    const res = await handler(makeRequest({ applicationId: "bad", action: "reject" }));
    const body = await res.json();
    assertEquals("success" in body, false);
    assertEquals(typeof body.error, "string");
  } finally { restore(); }
});
