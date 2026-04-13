# Scope
This file applies to `src/lib/server/db/schema/`.

## Why This Folder Exists
- This folder defines the app's database schema modules and their shared exports.

## Read This First
- `src/lib/server/db/schema/index.ts`
- `drizzle.config.ts`
- the matching migration files in `drizzle/`
- the services that query the table you are changing

## Architectural Rules
- Keep schema files focused on table shape, columns, keys, and relations.
- Export new schema modules through `src/lib/server/db/schema/index.ts`.
- Treat schema changes as contract changes for queries, seeds, and migrations.
- Do not hide business logic in schema modules.

## Key Entry Points
- `users.ts`
- `inventory.ts`
- `auctions.ts`
- `patients.ts`
- `messaging.ts`
- `catalog.ts`
- `index.ts`

## Local Conventions
- Keep table ownership split by domain file.
- Keep schema names aligned with drizzle migrations and consuming queries.
- Use the schema index as the shared import surface for the rest of the app.

## When Changing Code Here
- Update or add the matching migration in `drizzle/`.
- Check impacted services, route docs, and seed scripts.
- Verify `drizzle.config.ts` and schema exports still point at the correct modules.

## Related Docs
- `src/lib/server/AGENTS.md`
- `docs/api/AGENTS.md`
