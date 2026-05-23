# StudentShifts Edge Function API

All functions are deployed on Supabase and available at:
```
https://<project-ref>.supabase.co/functions/v1/<function-name>
```

All authenticated functions require:
```
Authorization: Bearer <supabase-jwt>
```

---

## Standard error response shape

Every function returns errors as JSON with a consistent shape:

```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|--------|---------|
| `400`  | Bad request — missing or invalid fields |
| `401`  | Unauthorised — missing or invalid JWT |
| `403`  | Forbidden — authenticated but not allowed |
| `404`  | Not found |
| `405`  | Method not allowed |
| `409`  | Conflict — idempotency key collision (retry) |
| `410`  | Gone — endpoint disabled |
| `429`  | Rate limit exceeded |
| `500`  | Internal server error |

---

## hire-applicant

**Auth:** Company JWT required  
**Method:** `POST`

Accept or reject a job applicant. Atomic: a single DB transaction updates application status, increments `filled_shifts`, and auto-declines competing applicants for the same shift. Sends Brevo emails to all affected students.

### Request body

```json
{
  "applicationId": "uuid",
  "action": "accept" | "reject",
  "idempotencyKey": "string (optional, max 256 chars)"
}
```

### Success — accept

```json
{
  "success": true,
  "filledShifts": ["Monday", "Tuesday"],
  "closedJob": false,
  "declinedIds": ["uuid", "uuid"]
}
```

- `filledShifts` — all shifts now filled for the job after this hire
- `closedJob` — `true` if all shifts are now filled (job auto-closed)
- `declinedIds` — application IDs auto-declined because their shift is now filled

### Success — reject

```json
{ "success": true }
```

### Success — idempotent replay

```json
{ "success": true, "idempotent": true, "cached": { ... } }
```

### Error responses

| Status | `error` value | Cause |
|--------|---------------|-------|
| `401`  | `Unauthorised` | No/invalid JWT or caller is not a company |
| `400`  | `Missing required fields: applicationId, action` | Invalid UUID or unknown action |
| `404`  | `Application not found` | Application does not exist or belongs to another company |
| `409`  | `Previous request did not complete — please retry.` | Orphaned idempotency key — safe to retry |
| `429`  | `Rate limit exceeded — max 10 hire actions per minute.` | More than 10 actions in 60 s |
| `500`  | `Internal server error` | Unexpected failure |

### Rate limit

10 accept/reject actions per company per minute (tracked in `hire_action_log`).

### Idempotency

Pass an `idempotencyKey` to safely retry. Without one, the function uses `${applicationId}:${action}` as the key. Duplicate requests within the same session return the cached result with `idempotent: true`.

---

## send-email

**Auth:** Company, student, or admin JWT required  
**Method:** `POST`

Multi-purpose email sender backed by Brevo. Behaviour depends on the request body shape.

### 1. New-applicant notification (student caller)

Sends a "new applicant" notification email to the company that owns the job.

```json
{ "type": "new-applicant", "jobId": "uuid" }
```

The student must have a valid application for `jobId`. Rate limit: 10 emails per student per hour.

**Success:** `{ "success": true }`

### 2. Company-interested template (company caller)

Sends a templated "a company is interested in you" email to a student. Companies cannot send arbitrary HTML — they must use this template type.

```json
{
  "templateType": "company_interested",
  "to": "student@example.com",
  "magicLinkEmail": "student@example.com",
  "redirectTo": "https://studentshifts.ie"
}
```

- `to` must be an email of a student who has applied to one of the company's jobs
- `magicLinkEmail` (optional) — if provided, must equal `to`; generates a one-click login link injected at `MAGIC_LINK_PLACEHOLDER` in the email HTML
- `redirectTo` (optional) — must be `studentshifts.ie` or the Render URL

**Success:** `{ "success": true }`

### 3. Job-closed notification (company caller)

Notifies all rejected applicants for a job that the position has been filled.

```json
{ "type": "job-closed", "jobId": "uuid" }
```

**Success:** `{ "success": true }`

### 4. Raw email (admin caller only)

```json
{
  "to": "user@example.com",
  "subject": "Subject line",
  "html": "<p>Body</p>",
  "magicLinkEmail": "user@example.com",
  "redirectTo": "https://studentshifts.ie"
}
```

`to` can be a string or an array of strings. `magicLinkEmail` must match all recipients if provided.

**Success:** `{ "success": true }`

### Rate limit

Company/admin: 60 emails per 5 minutes. Student (new-applicant path): 10 per hour.

---

## admin-actions

**Auth:** Admin JWT required  
**Method:** `POST`

Administrative actions that require service-role privileges.

### Request body

```json
{ "action": "revoke_session", "userId": "uuid" }
```

Currently supports one action:

| `action` | Effect |
|----------|--------|
| `revoke_session` | Invalidates all active sessions for `userId` (called after account rejection) |

### Success

```json
{ "success": true }
```

### Error responses

| Status | `error` value | Cause |
|--------|---------------|-------|
| `401`  | `Unauthorised` | No/invalid JWT |
| `403`  | `Forbidden` | Caller is not an admin |
| `400`  | `Missing required fields: action, userId` | Missing body fields |
| `400`  | `Unknown action` | Unsupported action string |
| `500`  | `{ "error": "..." }` | Supabase admin API error |

---

## register-interest

**Auth:** None (public endpoint)  
**Method:** `POST`  
**CORS:** Restricted to `studentshifts.ie` and `www.studentshifts.ie`

Pre-launch signup capture. Inserts into the `signups` table and sends a Brevo confirmation email. Duplicate emails are silently ignored.

### Request body — new signup

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "type": "student" | "employer"
}
```

Validation: `name` 2–100 chars, `email` valid format.

**Success:** `{ "success": true }`

### Request body — survey update

Updates existing signup row with survey answers (no email sent).

```json
{
  "survey": true,
  "email": "jane@example.com",
  "heard_about": "Instagram",
  "frustration": "...",
  "work_type": "...",
  "hire_platforms": "...",
  "hire_roles": "..."
}
```

**Success:** `{ "success": true }`

### Rate limit

20 new signups per 60 seconds globally (bot-storm protection).

### Kill switch

Set `DISABLE_REGISTER_INTEREST=true` in Supabase secrets to return `410 Gone` for all POST requests.

---

## send-launch-emails

**Auth:** Admin JWT required  
**Method:** `POST`

Batch-sends the launch announcement email to all pre-launch signups that haven't yet received one. Marks `launch_email_sent_at` after each successful send.

### Request body

```json
{}
```

Or, for a test send to the admin's own email without touching any signups:

```json
{ "test": true }
```

### Success

```json
{
  "sent": 42,
  "skipped": 2,
  "total": 44,
  "errors": ["jane@example.com: Brevo error 429"]
}
```

---

## sitemap

**Auth:** None (public endpoint)  
**Method:** `GET`

Returns an XML sitemap containing all active job pages plus static pages. Cached for 1 hour (`Cache-Control: public, max-age=3600`).

**Response:** `Content-Type: application/xml; charset=utf-8`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://studentshifts.ie</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  ...
</urlset>
```

On error, returns an empty `<urlset>` with status `500` so the sitemap endpoint never breaks crawlers.

---

## Environment variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | all | Supabase project URL |
| `SUPABASE_ANON_KEY` | all | Public anon key (caller auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | all | Service role key (admin operations) |
| `BREVO_API_KEY` | hire-applicant, send-email, register-interest, send-launch-emails | Brevo transactional email key |
| `FRONTEND_URL` | all except sitemap | CORS origin + magic link redirect (set to `https://studentshifts.ie` in prod) |
| `DISABLE_REGISTER_INTEREST` | register-interest | Set to `"true"` to disable pre-launch signups |
