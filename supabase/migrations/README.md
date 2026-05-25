# Supabase Migrations

New schema changes go here as dated migration files — one file per change.

## Naming convention

```
YYYYMMDDHHMMSS_short_description.sql
```

Example: `20260525120000_add_company_notes_column.sql`

## Workflow

```bash
# 1. Make a new migration file with the change
# 2. Run it in Supabase SQL Editor (or via CLI if linked)
# 3. Commit the file — it becomes the permanent audit trail
```

## Existing schema

The full current schema + all RLS policies live in `../rls_policies.sql`.
That file is **idempotent** (safe to re-run in full) and is the source of truth
for emergency resets. Migration files here are for incremental changes only.

## Linked migrations (already applied)

| File | Description | Applied |
|------|-------------|---------|
| `20260523000000_push_subscriptions.sql` | Web push subscription storage + RLS | 2026-05-23 |
