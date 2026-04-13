# API Docs

This project keeps a strict server boundary:

- Routes in `src/routes/api/**/+server.ts` are HTTP adapters only.
- Business logic lives in `src/lib/server/services/*`.
- Future assistant/tool invocations must use `src/lib/server/tools/*`, which delegate to the same services.

## Endpoints

- `GET /api/alarm-items`: `docs/api/alarm-items.md`
- `GET /api/drug-associations`: `docs/api/drug-associations.md`
- `POST /api/auction-reg`: `docs/api/auction-reg.md`
- `GET /api/usage-forecast`: `docs/api/usage-forecast.md`
- `GET /api/usage-forecast/drug-options`: `docs/api/usage-forecast-drug-options.md`
- `POST /api/usage-forecast/next-week`: `docs/api/usage-forecast-next-week.md`
- `POST /api/ems/pull-patient-data`: `docs/api/ems-pull-patient-data.md`
- `POST /api/demo/reset`: `docs/api/demo-reset.md`
- `GET /api/chat/sessions`, `POST /api/chat/sessions`: `docs/api/chat-sessions.md`
- `GET /api/chat/messages`: `docs/api/chat-messages.md`
- `POST /api/chat/send`: `docs/api/chat-send.md`
- `GET /api/openai/credentials`, `POST /api/openai/credentials`: `docs/api/openai-credentials.md`

## Tool Mapping

- Alerts: `src/lib/server/tools/alerts.ts`
- Drugs: `src/lib/server/tools/drugs.ts`
- Orders: `src/lib/server/tools/orders.ts`
- Forecast: `src/lib/server/tools/forecast.ts`
- Patients: `src/lib/server/tools/patients.ts`
- Demo: `src/lib/server/tools/demo.ts`
- Chat: `src/lib/server/tools/messages.ts`
- OpenAI credentials: `src/lib/server/tools/openai-credentials.ts`
