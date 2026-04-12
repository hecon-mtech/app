# `POST /api/ems/pull-patient-data`

## Purpose

Imports EMS patient data plus actual usage rows for the demo date range.

## Auth

Expected: authenticated hospital session.
Current implementation falls back to `HOSP0001` in demo/local flows.

## Request

No body.

Example:

```http
POST /api/ems/pull-patient-data
```

## Response

```json
{
  "message": "Patient data successfully inserted.",
  "startDate": "2024-12-01",
  "endDate": "2024-12-07",
  "outpatientCount": 120,
  "inpatientCount": 80,
  "actualUsageCount": 55,
  "sources": {
    "outpatient": "outpatient_input_1.parquet",
    "inpatient": "inpatient_input_1.parquet",
    "usage": "LAVAR_persistences.csv(real)"
  }
}
```

## Tables Touched

- `patients`
- `inventory`

## Side Effects

- Deletes existing hospital EMS-range patient rows.
- Deletes existing hospital actual inventory rows for the EMS range.
- Inserts new patient and actual usage rows.

## Related Service

- `src/lib/server/services/patients.ts#pullEmsPatientData`

## Related Tool

- `src/lib/server/tools/patients.ts#importEmsPatientData`
