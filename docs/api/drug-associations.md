# `GET /api/drug-associations`

## Purpose

Returns drugs that share the same ATC prefix group as the requested drug code.

## Auth

No explicit route guard. Intended for authenticated dashboard usage.

## Request

Query parameters:

- `drugId`: required drug code

Example:

```http
GET /api/drug-associations?drugId=8806427011209
```

## Response

```json
{
  "drugId": "8806427011209",
  "items": [
    {
      "drugCode": "8806427011209",
      "drugName": "약품명",
      "manufactor": "제조사",
      "atcCode": "J01CA04",
      "atcName": "ATC 이름"
    }
  ]
}
```

## Tables Touched

- `drugs`

## Side Effects

- None.

## Related Service

- `src/lib/server/services/drugs.ts#getDrugAssociations`

## Related Tool

- `src/lib/server/tools/drugs.ts#findAssociatedDrugs`
