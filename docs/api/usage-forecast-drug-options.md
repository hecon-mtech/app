# `GET /api/usage-forecast/drug-options`

## Purpose

Returns the distinct drug ids available in a date range for the usage forecast UI.

## Auth

Expected: authenticated hospital session.
Current implementation accepts `hospitalId` via query and falls back to `HOSP0001` in demo/local flows.

## Request

Query parameters:

- `hospitalId`: optional
- `start`: required `YYYY-MM-DD`
- `end`: required `YYYY-MM-DD`

Example:

```http
GET /api/usage-forecast/drug-options?hospitalId=HOSP0001&start=2024-12-01&end=2024-12-14
```

## Response

```json
{
  "drugIds": ["8806427011209", "8806436010708"]
}
```

## Tables Touched

- `inventory`

## Side Effects

- None.

## Related Service

- `src/lib/server/services/forecast.ts#getUsageForecastDrugOptions`

## Related Tool

- `src/lib/server/tools/forecast.ts#listUsageForecastDrugOptions`
