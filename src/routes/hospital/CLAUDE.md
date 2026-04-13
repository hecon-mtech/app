# Scope
This file applies to `src/routes/hospital/`.

## Why This Folder Exists
- This folder contains the authenticated hospital product UI.

## Read This First
- `src/routes/+layout.svelte`
- the specific page or `+page.server.ts` you are changing in this folder
- the related shared component in `src/lib/components/*`
- the related store in `src/lib/stores/*` when state is shared across pages

## Architectural Rules
- Pages in this folder own user flows, composition, and page-level data loading.
- Keep server-only logic out of client-side Svelte files.
- Prefer calling internal APIs or using page-server load/actions rather than duplicating business logic in UI code.
- Treat `/hospital/*` as the canonical authenticated tenant path unless tenant routing changes deliberately.

## Key Entry Points
- `chat/`: dashboard assistant experience.
- `data-input/`: upload and ingestion flows.
- `openai/`: connect and select credential flows.
- `order/`: order workflows.
- `profile/` and `settings/`: user-facing account and configuration pages.

## Local Conventions
- Shared shell and navigation behavior live above this folder in `src/routes/+layout.svelte`.
- Reuse shared components and stores instead of duplicating UI state per page.
- Keep page files focused on view concerns and feature orchestration.

## When Changing Code Here
- Check whether layout behavior, navigation, or shared stores are affected.
- If a page change depends on API or schema changes, update the matching docs and server layers too.
- Preserve authentication assumptions from `src/hooks.server.ts` and `src/lib/tenant.ts`.

## Related Docs
- `src/lib/server/AGENTS.md`
- `src/routes/api/AGENTS.md`
