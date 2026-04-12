# `GET /api/chat/sessions` and `POST /api/chat/sessions`

## Purpose

Lists persisted chat sessions and creates new persisted chat sessions.

## Auth

Expected: authenticated hospital session.
Current implementation falls back to `HOSP0001` in demo/local flows.

## `GET /api/chat/sessions`

Example:

```http
GET /api/chat/sessions
```

Response:

```json
{
  "sessions": [
    {
      "id": 3,
      "title": "2026/04/12 대화기록",
      "createdAt": "2026-04-12T10:00:00.000Z",
      "updatedAt": "2026-04-12T10:15:00.000Z"
    }
  ]
}
```

## `POST /api/chat/sessions`

Example:

```http
POST /api/chat/sessions
```

Response:

```json
{
  "session": {
    "id": 4,
    "title": "2026/04/12 대화기록",
    "createdAt": "2026-04-12T10:20:00.000Z",
    "updatedAt": "2026-04-12T10:20:00.000Z"
  }
}
```

## Tables Touched

- `message_session`

## Side Effects

- `GET`: none.
- `POST`: inserts a new `message_session` row.

## Related Service

- `src/lib/server/services/messages.ts#listChatSessions`
- `src/lib/server/services/messages.ts#createChatSession`

## Related Tool

- `src/lib/server/tools/messages.ts#listChatSessions`
- `src/lib/server/tools/messages.ts#createChatSession`
