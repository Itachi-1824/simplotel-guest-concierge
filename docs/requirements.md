# Assignment checklist

Mapped to the three-page “Build a Full-Stack AI-Powered Hotel Guest Assistant” assignment.

## Frontend

| Requirement | Implementation / evidence |
| --- | --- |
| Modern frontend | Astro 7 + React 19 |
| Clean conversational interface | Full-viewport concierge in `GuestExperience.jsx` |
| Enter and submit questions | Landing question field, chat composer, quick prompts |
| Distinct guest and assistant messages | Separate alignment, labels, colours, timestamps |
| Loading state | Thinking/tool status, streamed answer, disabled composer, stop control |
| API/AI failure state | Error message and retry; provider fallback |
| Follow-up questions | Per-session messages sent as bounded history |
| Dates and guest collection | Natural-language chat collection, automatic form filling, optional date inputs/guest stepper |
| Clear availability results | Room cards, totals, capacity, inventory label, empty state |
| Mobile and desktop | Responsive viewport layout and internal message scrolling |
| Call backend | Same-origin `POST /api/chat` |
| No browser API keys | Server environment variables only |

## Backend

| Requirement | Implementation / evidence |
| --- | --- |
| Question/context API | `src/pages/api/chat.js` |
| Small hotel knowledge base | `data/hotel.json` |
| Property, room, amenity, policy and FAQ answers | Source retrieval in `src/lib/assistant.mjs` |
| Detect availability | LLM chooses a typed hotel tool; local parsing and bounded Laya signals provide fallback |
| Mock availability tool | `checkAvailability(stay)` with validated dates and adults |
| Appropriate AI use | MiniLM, FlashRank, Laya, optional compatible LLM |
| Deterministic business logic outside LLM | Validation, capacity, occupancy and totals in code |
| Reliable unknown-answer fallback | Evidence gate, explicit abstention |
| Conversation context | Agent receives up to 16 recent messages and saved stay/preferences; `query-plan.mjs` supplies local follow-up parsing |
| Structured responses | Response types documented in `api.md` |
| Validation, errors and logging | Body/history limits, HTTP errors, type and duration logs |
| Meaningful automated tests | 133 Node tests, three Python signal tests, 15 general and 13 booking HTTP scenarios |

## Integration and evaluation

| Requirement | Evidence |
| --- | --- |
| Open app, ask question, receive answer | Browser walkthrough and HTTP tests |
| Frontend calls backend | Real `/api/chat` requests; observed server request logs |
| Follow-up and availability flow | Browser checks plus pipeline and API tests |
| Useful failure or fallback | Missing knowledge, model failure, invalid payload tests |
| At least 8–10 scenarios | 15 baseline and 16 local-model cases, plus failure tests |
| Normal questions | Check-in, pool, breakfast, family rooms, cancellation |
| Missing information | Availability without dates/guests |
| Ambiguous question | “Is it included?” |
| Availability/tool calling | Valid stay, invalid range, guest capacity, deterministic totals |
| Incorrect assumptions | Indoor pool, universal breakfast inclusion |
| Conversation follow-ups | Terrace Suite → breakfast; dates/guests across turns |
| Frontend loading and errors | Browser checks in `evaluation.md` |
| Backend/model failures | Offline provider, invented source, invalid indexes, malformed API requests |
| End-to-end frontend/backend | Browser question and availability walkthrough |

## Written deliverables

| Requirement | Location |
| --- | --- |
| Both source layers in GitHub | This repository: `src/` and `model_service/` |
| Complete setup/run instructions | `README.md`, `.env.example` |
| Architecture and data flow | `docs/architecture.md` |
| Working local frontend | `npm ci` → `npm run dev` |
| Backend API examples | `docs/api.md` |
| Customer problem and guest journey | `docs/architecture.md` |
| Frontend/product/engineering decisions | `docs/architecture.md` |
| AI versus deterministic choices | `docs/architecture.md` |
| Hallucination prevention and failures | `docs/architecture.md` |
| Usefulness measures and production improvements | `docs/architecture.md` |
| Evaluation scenarios and observed results | `docs/evaluation.md`, `docs/evaluation/*.json` |
| AI development tool disclosure | README and `docs/credits.md` |
| Deployment or recording | Public HTTPS demo plus documented local setup |
