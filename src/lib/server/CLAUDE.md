# Scope
This file applies to `src/lib/server/`.

## Why This Folder Exists
- This subtree owns server-only auth, session, business logic, assistant tools, and database access.

## Read This First
- `src/lib/server/auth.ts`
- `src/lib/server/session.ts`
- `src/lib/server/services/errors.ts`
- the specific service, tool, or db module you are changing

## Architectural Rules
- Keep this subtree server-only.
- Services own business logic and orchestration.
- Tools delegate to the same services used by HTTP routes; they should not fork business rules.
- DB modules own connection setup, query helpers, and schema exports.
- Keep dependency direction simple: routes and page-server code call services, tools call services, services use db and provider helpers.

## Key Entry Points
- `services/`: core business logic.
- `tools/`: assistant-facing wrappers over service behavior.
- `db/`: drizzle setup, config, facade, and schema.
- `auth.ts` and `session.ts`: login and session primitives.

## Local Conventions
- Use `ServiceError` for expected, user-facing failures.
- Keep provider-specific integration details inside focused service modules.
- Avoid importing client-only Svelte modules into this subtree.

## When Changing Code Here
- Trace callers in `src/routes/api/*` and `src/routes/**/+page.server.ts` before changing signatures.
- Keep tools and routes aligned when they expose the same behavior.
- Update `docs/api/*` when externally visible behavior changes.
- Update schema and migrations when database shape changes.

## Related Docs
- `src/routes/api/AGENTS.md`
- `src/lib/server/db/schema/AGENTS.md`
- `docs/api/AGENTS.md`
