# MTECH

Hospital operations dashboard and assistant shell built with SvelteKit.

## Architecture

- HTTP adapters live in `src/routes/api/**/+server.ts`.
- Business logic lives in `src/lib/server/services/*`.
- Future assistant/tool invocations must use `src/lib/server/tools/*`.
- Database schema modules live in `src/lib/server/db/schema/*`.

## API Docs

- Endpoint index: `docs/api/README.md`

## Developing

```sh
npm run dev
```

## Typecheck

```sh
npm run check
```

## Build

```sh
npm run build
```

Preview the production build locally with `npm run preview`.
