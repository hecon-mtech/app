# Scope
This file applies to `script/seed/`.

## Why This Folder Exists
- This folder owns database reset and seed scripts for local and development setup.

## Read This First
- the specific seed or reset script you are changing
- `src/lib/server/db/schema/index.ts`
- the matching migration files in `drizzle/`
- any fixture or input data file consumed by the script

## Architectural Rules
- Keep scripts focused on database reset, bootstrap, and seed tasks.
- Keep inserted table names and columns aligned with the current schema.
- Treat seed changes as downstream of schema and migration changes.
- Do not move application business logic into these scripts.
- Keep destructive operations explicit and scoped to the intended tables or schemas.

## Key Entry Points
- `reset-db.ts`
- `seed-users.ts`
- `seed-calendar.ts`
- `seed-drugs.ts`
- `seed-inventory-hosp0001.ts`
- `seed-patient-hosp0001.ts`

## Local Conventions
- Use env-driven database configuration consistently.
- Close database connections and pools before exit.
- Keep script arguments and default input file paths easy to trace.
- Preserve hospital IDs, fixture paths, and seed ordering assumptions unless the related schema or data contract changes.

## When Changing Code Here
- Update seed scripts when schema modules or migrations change.
- Verify referenced tables, columns, and enum-like values still match the schema.
- Check impacted fixture files, script arguments, and downstream setup steps.
- Keep reset scripts safe for the intended environment and avoid broadening destructive scope without a clear need.

## Related Docs
- `AGENTS.md`
- `src/lib/server/AGENTS.md`
- `src/lib/server/db/schema/AGENTS.md`
