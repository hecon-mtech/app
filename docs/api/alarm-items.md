# `GET /api/alarm-items`

## Purpose

Returns the floating alarm-panel cards shown in the dashboard shell.

## Auth

Expected: authenticated hospital session.
Current implementation falls back to `HOSP0001` in demo/local flows.

## Request

No body.

Example:

```http
GET /api/alarm-items
```

## Response

```json
{
  "items": [
    {
      "id": "stock-risk-8806427011209",
      "title": "재고/예측 경보",
      "preview": "약품명 (현재 0, best -4, worst -8)",
      "detail": "...",
      "level": "warn",
      "action": "open-order-modal",
      "targetDrugId": "8806427011209",
      "targetLabel": "약품명"
    }
  ]
}
```

## Tables Touched

- `inventory`
- `configurations`
- `drugs`
- `auction_reg_inventory`

## Side Effects

- None.

## Related Service

- `src/lib/server/services/orders.ts#getAlarmItems`

## Related Tool

- `src/lib/server/tools/alerts.ts#listAlerts`
