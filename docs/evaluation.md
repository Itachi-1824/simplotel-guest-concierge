# Evaluation

Tested with Node 24.13.1, Python 3.12.12, and CPU inference.

## Automated results

| Check | Result |
| --- | --- |
| Node backend, session, and request-limit tests | 112/112 passed |
| GPT-5.4 Nano language interpretation scenarios | 12/12 passed in the final recorded run |
| Python classifier-signal tests | 3/3 passed |
| Baseline answer/tool scenarios | 15/15 passed |
| Local-model scenarios | 15/16 passed |
| HTTP API scenarios | 15/15 passed on public HTTPS |
| Production build | Passed |
| npm dependency audit | 0 vulnerabilities reported |

Raw observations: [baseline](evaluation/baseline.json), [local models](evaluation/local-models.json), [HTTP API](evaluation/api.json). The availability clock is fixed in pipeline evaluations for repeatability. HTTP tests use future dates relative to the run.

The baseline covers all example questions from the assignment, missing details, ambiguity, unsupported assumptions, room availability, follow-ups, and unknown answers. Separate tests exercise offline providers, invalid model selections, malformed requests, capacity constraints, graph references, and corrupted saved state.

MiniLM, FlashRank, and Laya all loaded in the local run. Answering requests that used the models took approximately **1.6–2.1 seconds** on this machine; median **1.8 seconds**. Cold loading took about 20 seconds after download. These are small development-set observations, not a performance benchmark.

**Known miss:** “Where can I take a dip?” was expected to retrieve the pool but returned the safe fallback. Both trained retrieval scores were weak. The gate was retained rather than lowered to make this example pass. Broader paraphrase evaluation and domain calibration are needed before production. The test runner exits nonzero for this recorded miss.

Laya also ships a calibration warning for a high-cardinality temperature entry. Runtime choices here are small, but confidence is still treated as a bounded signal, not a probability. A regression test prevents low-confidence rejection from being inverted into high relevance.

The OpenAI-compatible request/response contract, valid source selection, malformed selections, and provider failure were tested with controlled responses. The deployed VPS also completed two real Pollinations `openai/gpt-5.6-luna` calls with `llm-extractive` traces and all three local models loaded. End-to-end pipeline times were 8.5 and 7.4 seconds. These checks confirm integration, not general model accuracy.

All nine HTTP API scenarios passed against the public HTTPS deployment. Production uses Python 3.12.3 and Laya 0.3.9; the earlier local model evaluation used Laya 0.3.7, which was no longer available from PyPI during deployment.

## Provider selection

Five models were compared through Pollinations with the same concise system prompt and three hotel evidence-selection tasks. All used a 1,200-token limit and 20-second timeout. Source IDs, sentence indexes, and required answer facts were checked.

| Model | Passed | Median provider response |
| --- | --- | --- |
| Mistral Large 3 | 3/3 | 4.64 s |
| GPT-5.4 Nano | 3/3 | 4.94 s |
| GPT-5.6 Luna | 3/3 | 5.69 s |
| GPT-5 Nano | 3/3 | 9.90 s |
| Nemotron 3.5 Lightning | 1/3 | 8.16 s; two truncated outputs |

Mistral Large 3 was initially selected, followed by GPT-5.4 Nano. The current deployment uses GLM-5.3 Flash after the later tool-call compatibility check below. These are small-sample observations, including provider/network latency; they exclude local retrieval and are not a general model ranking. [Raw results](evaluation/provider-models.json). Reproduce with `node --env-file=.env scripts/benchmark-models.mjs`; this makes 15 paid provider requests. The initial run exposed a JSON-mode compatibility requirement, fixed before this comparison.

After deployment, a real Mistral request completed the full retrieval pipeline in 8.98 seconds with an `llm-extractive` trace and MiniLM, FlashRank, and Laya loaded. The public mobile chat returned sourced breakfast and parking prices, and all nine public API checks passed again. A programming request returned the hotel fallback with `demo: true`.

The system prompt confines selection to the fictional hotel evidence. Regression tests also check unrelated requests, forged conversation instructions, and arbitrary provider text. Only validated sentences from trusted fixtures can be rendered; this does not claim universal jailbreak immunity.

## Browser checks

| Scenario | Observed result |
| --- | --- |
| Mobile 390 × 844 | Full-page welcome, photo, prompts and composer fit |
| Compact mobile 360 × 640 | Chat bounds 0–640 px; no horizontal overflow; composer remains visible |
| Windowed desktop 1280 × 720 | Chat bounds 0–720 px after resizing from mobile |
| Availability form | Native date inputs and guest stepper submit to the API |
| Three guests, 5–7 October | Terrace Suite €780 and Horizon Suite €1,040; sample inventory clearly labelled |
| Backend stopped during chat | Connection error displayed with a retry control; prior messages preserved |
| Reload | Conversation and folder assignments restored after hydration |
| Rename, move, archive, restore, search | Controls updated the saved conversation and folder correctly |
| Seven-step guide | Completed all steps; folder step opens and highlights the sidebar |
| Local AI request | Thinking state shown before the sourced room answer |
| Combined launcher | `npm run dev:ai` starts Astro and the Python service; all three models report loaded |
| Transcript export | Markdown file downloaded and checked; availability cards covered by a regression test |
| First visit / replay | Fresh browser origin automatically shows the guide; replay completes all seven steps |
| Folder create, rename, delete | Deleting the test folder moves its chat back to Unfiled |
| Delete active conversation | Confirmation removes the test chat and creates a usable fresh conversation |
| Stop response | Pending request cancels and a stopped-response message appears |

## Reproduce

```sh
npm test
npm run test:python
npm run eval
npm run eval -- --local
npm run test:api
```

Run the app before `test:api`, and the Python service before `eval -- --local`. The CI workflow verifies the keyless setup, backend tests, baseline scenarios, build, and HTTP API on Ubuntu.

For the browser failure check, load the app, stop its Node server, and send a question. Restart the server and retry. For loading, enable local AI and ask a new hotel question. Review the thinking indicator, then the sourced response. Test touch keyboard behaviour on physical phones before a production release; browser viewport emulation does not fully reproduce iOS keyboards.

## Stay planning and interaction update

The stay-planning tests include natural dates, relative durations, corrected departure dates, missing essentials across turns, automatic room selection, no matching filters, bounded classifier decisions, malformed preferences, quote tampering, unavailable inventory, and explicit room selection. All 15 HTTP scenarios pass locally, including chat-to-review and server-side quote recalculation.

At 390 × 844, a single complete chat request opened the report without a form. The confirmation button stayed visible; confirmation opened the labelled payment preview. At 1280 × 720, the dialog occupied y=20–700 with no horizontal overflow. Copy summary succeeded. Sound toggle confirmation and saved state were verified in the browser; physical speaker output is not measurable through the browser testing tool.

Four real local preference-classifier probes are recorded in [booking-classifier.json](evaluation/booking-classifier.json). Three raw classifications matched both expected labels. The negated-breakfast probe misclassified breakfast with confidence .0022; the gate rejected it, preserving the correct unrestricted breakfast preference. Effective preferences were correct on all four probes. This small development check does not establish general classification accuracy. Warm probes took about 0.4 seconds; first loading/inference took 8.4 seconds.

## Expanded sample-data regression checks

The fixture has 42 facts, four room categories, and 28 graph edges. Sixteen data-driven retrieval scenarios cover conditional fees, multiple sources, exceptions, and unavailable guarantees. Further tests check fixture integrity, special-request booking boundaries, and factual follow-ups after availability. At this stage the Node suite had 71 tests; the current suite has 112. These are focused development fixtures, not a claim of production-scale or general reasoning performance.

All 16 expanded retrieval cases also passed on the VPS with MiniLM, FlashRank, and Laya loaded, before the two contact facts were added. [Recorded local-model run](evaluation/complex-local.json). Reproduce with `node scripts/evaluate-complex.mjs --local`; omit `--local` to run the baseline. The evaluation is keyless and does not call the external LLM.

## Final deployment checks

All 15 HTTP checks passed on public HTTPS after the contact update. The mobile contact panel displayed the labelled demo details. A live stay request opened the report without using the form; this exposed a joined breakfast-preference phrase that is now covered by a regression test.

Pollinations accepted `max_tokens: 24000` with Mistral Large 3 and returned valid breakfast and parking source selections in 4.424 seconds. A separate full-pipeline probe used the grounded fallback, so provider success is not assumed for every request. The VPS reports all three local models loaded and 42 facts indexed.

## Laya-specific checks

The [Laya report](laya.md) records 40 preference cases, 16 intent cases, six query-selection cases, input validation, and a bounded concurrent-load check. Application preference results improved from 26/40 to 40/40, including 20 held-out cases. Raw classifier accuracy remains reported separately. An exploratory temperature fit was rejected because held-out calibration metrics worsened.

## Conversational interpretation update

The [12-case live-provider run](evaluation/language.json) passed through the assistant pipeline using GPT-5.4 Nano, the local model service, and fixed demo dates. It covers unfamiliar booking language, relative guest corrections, removal of requirements, uncertain counts, unsupported currency, multiple rooms, hotel paraphrases, special requirements, and an unrelated injected request.

Development failures are preserved in the [initial](evaluation/language-before.json), [intermediate](evaluation/language-intermediate.json), and [rejected prompt trial](evaluation/language-prompt-trial.json) reports. Those failures exposed unnecessary reconfirmation, overly narrow topic interpretation, and unchanged echoed preferences invalidating useful changes. The final prompt and field validation address those cases. This is a small development set, not an independent accuracy benchmark or a guarantee about arbitrary wording.

An [earlier native-tool run](evaluation/tool-calls-before.json) also exposed a guessed weekend and a pet question sent to clarification. The stay validator rejects explicitly undecided date changes, and the tool instructions require policy retrieval before handling special arrangements. Arguments use plain typed values rather than nested evidence wrappers.

The 102-test suite also exercises provider failure, typed tool arguments, invalid dates, explicit corrections overriding model proposals, unchanged-value normalization, and hotel questions that must not alter a stay. Native function calls replace the earlier JSON intent envelope. Tool validation rejects unknown actions, extra arguments, multiple calls, and free-text booking claims. Run `node --env-file=.env scripts/evaluate-language.mjs` to repeat the paid provider evaluation. Exact reported conversations are covered separately by [13 HTTP checks](evaluation/booking-flow.json).

## Adversarial journey and current provider

The [single browser journey](evaluation/adversarial-e2e.md) preserved dates, two guests and a EUR 380 Classic Room quote through corrections, policy questions, attempted role overrides and a reload, then reached the labelled payment preview. It also exposed a repeated prior answer and an upstream content-filter rejection; both observations and their fixes are recorded.

The [five-model tool-call check](evaluation/tool-model-comparison.json) used one identical request per model. GLM-5.3 Flash, GPT-5.4 Nano, GPT-5 Nano and Mistral Large 3 returned valid stay tools. Cohere did not. GLM completed the subsequent live final-review request with a valid prepare_stay call in 11.386 seconds end to end. Selection reflects compatibility and user preference, not a claim that it was fastest or generally most accurate.

The suite now has 112 passing Node tests. New cases cover distinct retry seeds, retry exhaustion, rate-limit backoff, provider budgets, no retry on content filters or invalid requests, polite redirection and removal of refused overrides from later interpretation history.
