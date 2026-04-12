# `GET /api/usage-forecast`

## Purpose

Returns actual usage, prediction, upper bound, and lower bound series for a single drug.

## Auth

Expected: authenticated hospital session.
Current implementation accepts `hospitalId` via query and falls back to `HOSP0001` in demo/local flows.

## Request

Query parameters:

- `hospitalId`: optional
- `drugId`: required
- `start`: required `YYYY-MM-DD`
- `end`: required `YYYY-MM-DD`
- `actualEnd`: optional `YYYY-MM-DD`

Example:

```http
GET /api/usage-forecast?hospitalId=HOSP0001&drugId=8806427011209&start=2024-12-01&end=2024-12-14&actualEnd=2024-12-07
```

## Response

```json
{
  "labels": ["2024-12-01", "2024-12-02"],
  "actual": [12, 10],
  "prediction": [null, 14],
  "upper": [null, 18],
  "lower": [null, 9]
}
```

## Tables Touched

- `inventory`

## Side Effects

- None.

## Related Service

- `src/lib/server/services/forecast.ts#getUsageForecast`

## Related Tool

- `src/lib/server/tools/forecast.ts#getUsageForecast`
