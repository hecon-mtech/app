# `GET /api/openai/credentials` and `POST /api/openai/credentials`

## Purpose

Reads and saves OpenAI credential state for the current logged-in hospital record.

## Auth

Expected: authenticated hospital session.
Current implementation falls back to `HOSP0001` in demo/local flows.

## `GET /api/openai/credentials`

Example:

```http
GET /api/openai/credentials
```

Response:

```json
{
  "hasOauth": true,
  "hasApiKey": true,
  "apiKeyPreview": "sk-a...1234",
  "updatedAt": "2026-04-12T10:30:00.000Z"
}
```

## `POST /api/openai/credentials`

OAuth save example:

```json
{
  "oauth": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": 1712937600
  }
}
```

API key save example:

```json
{
  "apiKey": "sk-..."
}
```

Response:

```json
{
  "hasOauth": true,
  "hasApiKey": true,
  "apiKeyPreview": "sk-a...1234",
  "updatedAt": "2026-04-12T10:30:00.000Z"
}
```

## Tables Touched

- `users`

## Side Effects

- `POST` updates `users.oauth`, `users.api_key`, and `users.updated_at`.

## Related Service

- `src/lib/server/services/openai-credentials.ts#getOpenAiCredentialStatus`
- `src/lib/server/services/openai-credentials.ts#saveOpenAiCredentials`

## Related Tool

- `src/lib/server/tools/openai-credentials.ts#getOpenAiCredentialStatus`
- `src/lib/server/tools/openai-credentials.ts#saveOpenAiCredentials`
