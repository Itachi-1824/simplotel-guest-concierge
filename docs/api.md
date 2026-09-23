# API

`POST /api/chat` accepts a question, optional conversation history, and optional stay details. Keys remain on the server. Responses use `Cache-Control: no-store`.

```sh
curl http://localhost:4321/api/chat -H "Content-Type: application/json" -d '{"question":"What time is check-in?"}'
```

```json
{
  "type": "answer",
  "answer": "Check-in begins at 3:00 PM. Check-out is by 11:00 AM. Early check-in and late check-out are subject to availability and cannot be guaranteed.",
  "sources": [{"id": "arrival", "topic": "Stay essentials"}]
}
```

Follow-up:

```sh
curl http://localhost:4321/api/chat -H "Content-Type: application/json" -d '{"question":"And breakfast?","history":[{"role":"user","content":"Tell me about the Terrace Suite"}]}'
```

Availability (choose future dates):

```sh
curl http://localhost:4321/api/chat -H "Content-Type: application/json" -d '{"question":"Check availability","stay":{"checkIn":"2027-01-10","checkOut":"2027-01-12","adults":3}}'
```

PowerShell equivalent:

```powershell
$body = @{ question = 'What time is check-in?' } | ConvertTo-Json
Invoke-RestMethod http://localhost:4321/api/chat -Method Post -ContentType 'application/json' -Body $body
```

| Type | Additional fields |
| --- | --- |
| `answer` | `answer`, `sources` |
| `clarification` / `fallback` | `answer`, empty `sources` |
| `availability-needed` | `answer`, `missing` |
| `availability` | `availability`: dates, adults, nights, rooms, currency, `mock: true` |

Room results contain ID, name, description, capacity, nightly price, total price, and remaining sample inventory. An empty room list is a valid result. Stays must be 1–30 nights, with 1–4 guests and valid, non-past ISO dates.

Validation failures return HTTP `400` with `{ "error": "..." }`; oversized requests return `413`; unexpected backend failures return `503`. Questions are 2–600 characters. History accepts up to 16 user/assistant turns, each up to 1,200 characters; the assistant uses the most recent eight. Invalid history roles are rejected.

`GET /api/health` checks the app. Local AI status and API documentation are at `http://127.0.0.1:8001/health` and `/docs`. The browser never calls the local model service directly.
