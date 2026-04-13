# Scope
This file applies to `src/routes/api/`.

## Why This Folder Exists
- This folder is the HTTP boundary for internal API endpoints.

## Read This First
- `README.md`
- `docs/api/README.md`
- `src/lib/server/AGENTS.md`
- the matching endpoint doc in `docs/api/*`

## Architectural Rules
- `+server.ts` files are thin HTTP adapters only.
- Parse request input, read `locals.user`, call the service layer, and translate service errors into HTTP responses.
- Keep business logic in `src/lib/server/services/*`.
- Do not add direct SQL, schema definitions, provider SDK flows, or long data transforms here.

## Key Entry Points
- `chat/`: sessions, messages, sends, and uploads.
- `openai/`: credential and model endpoints.
- `usage-forecast/`: forecast queries and options.
- `demo/`, `ems/`, `auction-reg/`, `alarm-items/`, `drug-associations/`: feature-specific adapters.

## Local Conventions
- Prefer `json(...)` responses and `ServiceError` handling patterns already used in this folder.
- Authentication is set up by `src/hooks.server.ts`; route handlers should consume `locals.user` instead of reimplementing auth.
- Keep route files small and focused on HTTP concerns.

## When Changing Code Here
- Inspect the called service before changing endpoint behavior.
- Update the matching file in `docs/api/` when request, response, auth, or side effects change.
- If the route exists only to expose assistant data, verify the tool path in `src/lib/server/tools/*` still matches.

## Related Docs
- `docs/api/AGENTS.md`
- `src/lib/server/AGENTS.md`
