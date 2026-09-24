# Architecture and decisions

```mermaid
flowchart TD
  A[Astro page + React interface] -->|POST question, history, stay| B[Astro Node API]
  B --> C{LLM agent enabled?}
  C -->|Yes| D[Model with recent conversation and saved stay]
  D --> E[Validate native tool arguments]
  E --> F[prepare_stay: code validates inventory and prices]
  E --> G[search_hotel_information]
  G --> H[Known fact IDs: direct lookup]
  G --> I[Broader query: BM25 + MiniLM + FlashRank + Laya + graph]
  F --> D
  H --> D
  I --> D
  D --> J[Stream answer and canonical result]
  C -->|No or provider unavailable| K[Local parsing, retrieval and source answers]
  K --> J
  J --> A
```

## Product and UX

Guests need reliable answers before choosing a room. The journey moves from a hotel introduction straight into a full-page conversation, with hotel discovery one scene further on. A stay planner collects dates and guest count without losing the conversation.

The mobile composer remains visible while messages scroll. Short screens receive a compact welcome; larger screens include photography. Teal provides a calm visual anchor, warm ivory reduces stark contrast, and muted brass distinguishes secondary accents. These are design hypotheses, not claims that a colour guarantees bookings. Motion respects reduced-motion preferences; sound is opt-in.

Sessions have automatic titles, manual rename, archive/restore, delete confirmation, search, and Markdown export. Folders group travel plans without introducing account setup. A replayable seven-step tour introduces the controls. Local persistence is a deliberate assessment simplification, not a substitute for secure accounts.

## AI boundaries

The JSON knowledge base contains 42 facts and four room types. BM25 provides a fast baseline. MiniLM adds semantic retrieval, FlashRank reranks eight candidates, and reciprocal rank fusion combines signals. A small reviewed graph connects room entities to policies. This is one-hop graph-assisted RAG, not a community-summary GraphRAG implementation.

Laya is a local classifier, not a text generator. It classifies intent, chooses among supplied query candidates, and judges candidate relevance. Its influence is capped; it cannot invent facts, prices, inventory, or graph edges. `npm run graph:propose` produces offline graph suggestions in `.cache/graph-proposals.json` for human review. It never changes the active graph.

Availability, date arithmetic, capacity limits, and prices are ordinary code. The optional LLM interprets conversational requests into typed tool arguments and writes answers using returned evidence. Invalid tool fields and unknown fact IDs are rejected. Source labels come from actual tool results. Explicitly parsed guest counts take precedence over model proposals. Ambiguous instructions prompt clarification without replacing the active stay. Generated prose is not checked claim by claim and can still be wrong.

With `CONCIERGE_AGENT_ENABLED=1`, the agent exposes two tools: `prepare_stay` and `search_hotel_information`. It can inspect results and continue, with at most 25 total tool calls per answer. Independent searches run in parallel; state-changing stay checks run sequentially. Identical calls share their result within a turn. Code validates names, argument keys, field types, and allowed values before dispatch. Exact fact IDs bypass semantic retrieval; broader searches use the local pipeline. The model has no payment, reservation, shell, or external browsing tool. No arbitrary function name can execute code. With the agent disabled, the earlier single-call interpreter remains available.

The agent receives up to 16 recent user/assistant messages and the saved stay/preferences. Browser history is capped at 14 KB, with 1,200 characters per message. Conversation memory is bounded; this is not unlimited recall. Provider streaming stays open across tool rounds; the browser persists only the final canonical result. Markdown permits text formatting and safe links, disables raw HTML and images, and makes tables scroll inside their messages.

## Failure handling

| Failure | Behaviour |
| --- | --- |
| Missing dates or guests | Ask for all missing essentials in chat; fill the optional form |
| Invalid dates/capacity | Explain the validation error |
| Unknown or ambiguous question | Abstain or ask for clarification |
| Local model unavailable | Eight-second timeout; baseline retrieval; 15-second circuit breaker |
| Transient LLM failure | One retry with a fresh seed and short randomized backoff; optional fallback model; 12-second timeout per attempt in the tested configuration |
| Invalid tool output / eligible compatibility error | Try the configured fallback before returning to local handling |
| LLM unavailable/invalid after retry | Local handling and complete source facts; uncertain requests ask for clarification |
| Provider content filter / role override | Polite refusal and hotel redirect; no retry; refused overrides omitted from later interpretation history |
| Frontend request fails | Visible error, preserved messages, retry control |
| Guest stops a streamed answer | Cancel the response and upstream completion; incomplete text is not saved as a successful answer |
| Browser storage unavailable | Continue in memory; show saving unavailable |

Grounding reduces unsupported answers but does not prove factuality or jailbreak immunity. Retrieval can select the wrong fact, omit a qualification, or miss a paraphrase; the LLM can misread evidence. Laya confidence is not a calibrated probability. Deterministic validation protects quotes and inventory independently of answer wording. The evaluation includes negative and ambiguous cases; more models alone do not establish better quality.

## Measurement and production work

Measure answer correctness, source relevance, unsupported-answer rate, clarification success, availability completion, latency, and guest helpfulness feedback. In a controlled rollout, compare direct-booking completion against a control group; avoid attributing all conversion changes to chat.

Before production: connect a real booking system, tenant-scoped data and authentication, encrypted server persistence, rate limiting, monitoring, content versioning, human handoff, provider privacy controls, broader multilingual and accessibility testing, and calibrated retrieval thresholds. Current inventory is deterministic mock data; there is no payment or booking operation.

## Autonomous demo stay planning

`query-plan.mjs` parses ISO or natural English dates with Chrono, using the hotel’s Europe/Rome calendar. Ambiguous slash dates require clarification. `room-preferences.mjs` combines explicit inputs with bounded Laya outlook/breakfast classifications. `/v1/booking-intent` runs locally, separately from retrieval, with a 3.5-second client timeout and a deterministic fallback. Laya is a local classifier, not an LLM; `LAYA_ROLE` exposes this distinction in code and service health.

Laya preference choices require a normalized winning score ≥ .90, a ≥ .30 margin, and entropy confidence ≥ .10. These are acceptance gates, not calibrated probabilities. Uncertain or malformed choices cannot alter the plan. Explicit form values win. Selected preferences remain visible for guest review. The LLM interpreter is a separate optional language layer; its output cannot bypass validation or quote calculations.

Code checks capacity, every night’s mock inventory, numeric budgets, documented views, and breakfast inclusion. Matching rooms are sorted by sample nightly price. A complete chat request opens a review automatically; a structured form request offers room comparison first. `/api/quote` recomputes the price and availability, ignores client totals, verifies preferences, and supplies the report. Confirmation rechecks the quote before the payment preview. No reservation, room hold, external hotel search, personal-data collection, or payment operation exists.
