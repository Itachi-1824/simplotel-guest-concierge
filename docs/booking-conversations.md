# Booking conversations

The chat keeps the latest validated stay details with each conversation, separate from the short text history used for retrieval. New dates, guest counts, and explicit preferences update that state. Factual questions such as “Is parking available?” stay on their own topic.

The regression suite includes these reported failures:

| Message | Expected result |
| --- | --- |
| Can you book a room for 2 from oct 7–12 please | Two guests, both October dates |
| 5–7, two | Reuse the established month, update the dates, retain two guests |
| need smth only for 2 not 4 | Two guests, no child-policy retrieval |
| hmm anything thats available? | Recheck the active stay and show nearby options when sold out |
| 2 | Accept a single-digit guest correction |

Dates without a known month require clarification. Nearby options search arrivals up to 14 days earlier or later, retaining the stay length, guest count, and preferences. Suggestions do not overwrite the original dates or open a payment preview automatically. Choosing an option requests a fresh server quote.

Run `node --test tests/booking-conversation.test.mjs` for the deterministic regressions. `node scripts/test-booking-flow.mjs` replays the reported October 2026 scenarios over HTTP; set `TEST_BASE_URL` to the deployment under test. The dated HTTP fixture needs updating after that assessment period.

The [HTTP results](evaluation/booking-flow.json) accompany browser checks of the desktop and 390 × 844 mobile flows, including stay review and the labelled payment preview. These are measured cases, not a guarantee that every possible natural-language request is understood.

GPT-5.4 Nano is the configured chat model. Booking interpretation, inventory, and pricing corrections are application changes; changing the language model alone would not have fixed these failures.

## Language interpretation

The interpreter receives the current message, saved stay, preferences, three recent guest messages, hotel date, and a compact topic catalog. GPT selects one of four function calls and proposes plain typed arguments from the current message. Unchanged echoed values are discarded. Explicitly parsed values take precedence, and the server validates the resulting stay before checking inventory or producing a quote. Ambiguous counts, currencies, and unconfirmed special arrangements ask for clarification. A scalar reply such as `5–7, two` retains the known month if model interpretation fails or unnecessarily asks for it again.

The prompt separates current requests from saved context, accepts clear corrections without reconfirming old values, and rewrites factual paraphrases into retrieval queries. A question about bringing a dog retrieves the pet policy without claiming an approved pet booking. Provider failures retain local handling and cannot create a payment or reservation.

Polli's conversation framing, semantic-plus-exact retrieval, verified tool results, and explicit capability boundaries informed this design. This application uses bounded interpretation and deterministic hotel tools rather than Polli's general repository-search loop. The PDF's requirement to keep deterministic business logic outside the LLM remains intact.
