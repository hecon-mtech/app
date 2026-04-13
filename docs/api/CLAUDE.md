# Scope
This file applies to `docs/api/`.

## Why This Folder Exists
- This folder is the endpoint contract map for the app's internal HTTP API.

## Read This First
- `docs/api/README.md`
- the matching route in `src/routes/api/**/+server.ts`
- the called service in `src/lib/server/services/*`
- the related tool in `src/lib/server/tools/*` when assistant access is involved

## Architectural Rules
- Keep one doc per endpoint or closely related endpoint group.
- Treat route docs as the fast path for understanding auth, payloads, side effects, and related code.
- Keep docs aligned with the actual route, service, and tool wiring.
- Do not document generated files, local secrets, or seed fixtures here.

## Local Conventions
- Match the existing structure: `Purpose`, `Auth`, `Request`, `Response`, `Tables Touched`, `Side Effects`, `Related Service`, `Related Tool`.
- Use route-shaped filenames such as `chat-send.md` and `usage-forecast-next-week.md`.
- Keep examples concrete and small.

## When Changing Code Here
- Update the matching doc whenever endpoint auth, payload shape, response shape, side effects, or table usage changes.
- Update `docs/api/README.md` when adding or removing an endpoint doc.
- Verify the documented service and tool references still point at the current implementation.

## Related Docs
- `README.md`
- `src/routes/api/AGENTS.md`
- `src/lib/server/AGENTS.md`
