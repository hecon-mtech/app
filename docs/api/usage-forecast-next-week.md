# `POST /api/usage-forecast/next-week`

## Purpose

Refreshes the next-week prediction rows from `script/seed/LAVAR_persistences.csv`.

## Auth

Expected: authenticated hospital session.
Current implementation falls back to `HOSP0001` in demo/local flows.

## Request

No body.

Example:

```http
POST /api/usage-forecast/next-week
```

## Response

```json
{
  "message": "다음주 예측이 반영되었습니다.",
  "startDate": "2024-12-08",
  "endDate": "2024-12-14",
  "predictionCount": 42
}
```

## Tables Touched

- `inventory`

## Side Effects

- Deletes existing next-week prediction rows for the hospital.
- Inserts new `prediction`, `prediction_upper`, and `prediction_lower` rows.

## Related Service

- `src/lib/server/services/forecast.ts#refreshNextWeekPrediction`

## Related Tool

- `src/lib/server/tools/forecast.ts#refreshNextWeekPrediction`
