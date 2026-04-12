# `GET /api/chat/messages`

## Purpose

Loads the full persisted transcript for a single chat session.

## Auth

Expected: authenticated hospital session.
Current implementation falls back to `HOSP0001` in demo/local flows.

## Request

Query parameters:

- `sessionId`: required numeric session id

Example:

```http
GET /api/chat/messages?sessionId=3
```

## Response

```json
{
  "session": {
    "id": 3,
    "title": "2026/04/12 대화기록",
    "createdAt": "2026-04-12T10:00:00.000Z",
    "updatedAt": "2026-04-12T10:15:00.000Z"
  },
  "messages": [
    {
      "id": 11,
      "role": "user",
      "content": "이번주 재고 리스크를 요약해줘",
      "createdAt": "2026-04-12T10:01:00.000Z"
    },
    {
      "id": 12,
      "role": "assistant",
      "content": "재고 리스크는 ...",
      "createdAt": "2026-04-12T10:01:00.000Z"
    }
  ]
}
```

## Tables Touched

- `message_session`
- `messages`

## Side Effects

- None.

## Related Service

- `src/lib/server/services/messages.ts#getChatMessages`

## Related Tool

- `src/lib/server/tools/messages.ts#loadChatMessages`
