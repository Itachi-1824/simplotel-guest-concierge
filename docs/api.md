# API

`POST /api/chat` accepts a question, optional conversation history, and optional stay details. Keys remain on the server. JSON responses use `Cache-Control: no-store`.

```sh
curl http://localhost:4321/api/chat -H "Content-Type: application/json" -d '{"question":"What time is check-in?"}'
```

```json
{
  "type": "answer",
  "answer": "Check-in begins at 3:00 PM. Check-out is by 11:00 AM. Early check-in and late check-out are subject to availability and cannot be guaranteed.",
  "sources": [{"id": "arrival", "topic": "Stay essentials"}],
  "demo": true
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
| `availability-needed` | `answer`, `missing`, partial `stay`, `preferences` |
| `availability` | `availability`: dates, adults, nights, rooms, currency, `mock: true`; complete natural requests include `bookingPlan` |

Room results contain ID, name, description, capacity, nightly price, total price, and remaining sample inventory. An empty room list is a valid result. Stays must be 1–30 nights, with 1–4 guests and valid, non-past ISO dates.

All successful chat responses include `demo: true`. The property, facts, rates, and inventory are fictional stub data; see [reviewer examples](demo-data.md).

Validation failures return HTTP `400` with `{ "error": "..." }`; oversized requests return `413`; unexpected backend failures return `503`. Questions are 2–600 characters, with a single digit also allowed for guest-count replies. History accepts up to 16 user/assistant messages, each up to 1,200 characters. The agent uses all accepted recent messages; the older local pipeline uses a shorter window. Invalid history roles are rejected. The browser also trims serialized history to 14 KB to fit the 20,000-character request limit.

Chat also accepts `bookingContext: {stay: {checkIn, checkOut, adults}, preferences}`. Fields may be omitted while details are collected. This preserves the active stay beyond the short text history. Dates, counts, and preferences are validated; client prices or extra properties cannot alter inventory or quotes. Current explicit changes override the saved values. An empty availability result may include `alternatives`, each containing changed dates, the same guests and nights, and a matching sample room. Choosing one still requires a fresh `/api/quote` request.

`GET /api/health` checks the app. Local AI status and API documentation are at `http://127.0.0.1:8001/health` and `/docs`. The browser never calls the local model service directly.

## Stay preferences and review

Chat accepts optional `preferences`: `nightlyBudget` (EUR per night, 1–10,000 or null), `view` (`any`, `sea`, `terrace`), `breakfastIncluded` (boolean), and `roomId` (a fixture category or null). Explicit values override inferred preferences. The natural-language flow returns a `bookingPlan` containing validated stay details, selected room, preferences, and `autonomous: true`.

`POST /api/quote` accepts `{ "roomId": "terrace", "stay": { "checkIn": "2026-10-05", "checkOut": "2026-10-07", "adults": 3 }, "preferences": { "nightlyBudget": 400 } }`. Use future dates. It returns the server-calculated quote, a comparison report, 15-minute expiry, `demo: true`, and `paymentEnabled: false`. Unknown rooms or invalid inputs return 400; unavailable or nonmatching rooms return 409. Client-supplied prices are ignored. The UI requests a fresh quote again on confirmation. There is no payment API.

The private Python `POST /v1/booking-intent` accepts `{ "question": "..." }` and returns bounded Laya outlook/breakfast choices. It is not exposed to browser clients.

## Streaming

Add `Accept: text/event-stream` to `/api/chat`. Without it, the API retains the JSON response contract above.

```sh
curl -N http://localhost:4321/api/chat -H "Content-Type: application/json" -H "Accept: text/event-stream" -d '{"question":"What is available for dinner?"}'
```

The response uses SSE `data:` frames containing JSON objects:

| Event `type` | Payload / behaviour |
| --- | --- |
| `status` | `text`: current thinking or tool activity |
| `reset` | Clear provisional answer text before a new tool round or retry |
| `text` | `text`: the full provisional answer so far; replace, do not append |
| `heartbeat` | Keepalive while work continues |
| `result` | `result`: final canonical JSON response, including sources and `demo: true` |
| `error` | `message`: display a retryable connection error |

Keep reading across tool rounds until `result` or `error`. Only `result` is a completed answer suitable for persistence. Validation errors still use JSON and an HTTP error status before streaming starts. Errors after headers are sent appear as `error` events within HTTP 200. Closing the stream cancels the upstream completion. Streaming responses disable proxy buffering and transformations. Without an LLM, status is followed by the complete local result.
