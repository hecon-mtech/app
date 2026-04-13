# Scope
This file defines repo-wide context lookup for AI agents working in this repository.

## Mirror Rule
- In every folder that contains both `AGENTS.md` and `CLAUDE.md`, the two files must mirror each other exactly.
- If one changes, update the sibling in the same patch so they stay byte-identical.

## Why This Repo Exists
- SvelteKit hospital operations dashboard and assistant shell.

## Context Lookup Order
1. Read this file first.
2. Read the closest `AGENTS.md` or `CLAUDE.md` in the subtree you are changing.
3. Open only the key files for that area.
4. Avoid scanning generated, vendored, secret, or binary paths unless the task requires them.

## Repo Tree
- `README.md`: repo overview and architecture rules.
- `docs/api/`: endpoint docs and route-to-service/tool mapping.
- `src/routes/api/`: HTTP adapters only.
- `src/routes/hospital/`: authenticated hospital UI pages.
- `src/lib/server/`: auth, session, services, tools, and db access.
- `src/lib/server/db/schema/`: database schema modules.
- `drizzle/`: SQL migrations and drizzle metadata.
- `script/seed/`: reset and seed scripts plus large fixtures.
- `static/`: public assets and templates.

## Global Architecture Rules
- `src/routes/api/**/+server.ts` are HTTP adapters only.
- Business logic lives in `src/lib/server/services/*`.
- Assistant and tool entrypoints live in `src/lib/server/tools/*`.
- Database schema modules live in `src/lib/server/db/schema/*`.
- Authenticated request handling starts in `src/hooks.server.ts`.

## Read This First
- API work: `src/routes/api/AGENTS.md`
- Hospital UI work: `src/routes/hospital/AGENTS.md`
- Server logic: `src/lib/server/AGENTS.md`
- Schema changes: `src/lib/server/db/schema/AGENTS.md`
- Endpoint contract changes: `docs/api/AGENTS.md`

## Ignore By Default
- `.svelte-kit/`
- `node_modules/`
- `.git/`
- `.env`
- `static/templates/*.xlsx`
- `static/*.png`
- `script/seed/*.parquet`
- large seed `.csv` fixtures in `script/seed/`

## When Changing Code
- Keep changes in the narrowest layer that owns the behavior.
- If an API request or response changes, update `docs/api/*`.
- If schema changes, update `drizzle/` and impacted services.
- Do not move business logic into route handlers or Svelte components.
