# `POST /api/auction-reg`

## Purpose

Registers an auction order request for a hospital and drug.

## Auth

Required. Returns `401` when `locals.user` is missing.

## Request

Body:

```json
{
  "drugId": "8806427011209",
  "quantity": 12
}
```

## Response

```json
{
  "message": "주문이 등록되었습니다.",
  "id": 42,
  "drugId": "8806427011209",
  "quantity": 12,
  "expireAt": "2026-04-12T12:34:56.000Z"
}
```

## Tables Touched

- `drugs`
- `auction_reg_inventory`

## Side Effects

- Inserts a new `auction_reg_inventory` row.

## Related Service

- `src/lib/server/services/orders.ts#createAuctionOrder`

## Related Tool

- `src/lib/server/tools/orders.ts#createAuctionOrder`
