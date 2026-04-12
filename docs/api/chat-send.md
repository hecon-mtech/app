# `POST /api/chat/send`

## Purpose

Persists a user message, generates the current assistant reply, persists that reply, and returns the updated transcript.

## Auth

Expected: authenticated hospital session.
Current implementation falls back to `HOSP0001` in demo/local flows.

## Request

Body:

```json
{
  "sessionId": 3,
  "content": "알림 버튼에서 어떤 조치를 먼저 봐야 해?"
}
```

## Response

```json
{
  "session": {
    "id": 3,
    "title": "2026/04/12 대화기록",
    "createdAt": "2026-04-12T10:00:00.000Z",
    "updatedAt": "2026-04-12T10:16:00.000Z"
  },
  "messages": [
    {
      "id": 13,
      "role": "user",
      "content": "알림 버튼에서 어떤 조치를 먼저 봐야 해?",
      "createdAt": "2026-04-12T10:16:00.000Z"
    },
    {
      "id": 14,
      "role": "assistant",
      "content": "알림 버튼은 상시 노출되고 ...",
      "createdAt": "2026-04-12T10:16:00.000Z"
    }
  ]
}
```

## Tables Touched

- `message_session`
- `messages`

## Side Effects

- Inserts one `user` message row.
- Inserts one `assistant` message row.
- Updates `message_session.updated_at`.

## Related Service

- `src/lib/server/services/messages.ts#sendChatMessage`

## Related Tool

- `src/lib/server/tools/messages.ts#sendChatMessage`
