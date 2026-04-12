# `POST /api/demo/reset`

## Purpose

Resets demo data back to the 2024-12-07 baseline.

## Auth

Expected: authenticated hospital session.
Current implementation falls back to `HOSP0001` in demo/local flows.

## Request

No body.

Example:

```http
POST /api/demo/reset
```

## Response

```json
{
  "message": "데모 데이터가 12/07 기준 상태로 초기화되었습니다.",
  "ranges": {
    "baselineCutoff": "2024-12-07",
    "actualAndPatientsRemovedAfter": "2024-12-01",
    "predictionRemovedAfter": "2024-12-08",
    "auctionRemovedAfter": "2024-12-08"
  }
}
```

## Tables Touched

- `auction_bids`
- `auction_reg_inventory`
- `patients`
- `inventory`

## Side Effects

- Deletes post-baseline demo rows for orders, bids, patients, and prediction/actual inventory.

## Related Service

- `src/lib/server/services/demo.ts#resetDemoData`

## Related Tool

- `src/lib/server/tools/demo.ts#resetDemoWorkspace`
