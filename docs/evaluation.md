# Evaluation

Tested on 23 September 2026 with Node 24.13.1, Python 3.12.12, and CPU inference.

## Automated results

| Check | Result |
| --- | --- |
| Node backend and session tests | 27/27 passed |
| Python classifier-signal tests | 3/3 passed |
| Baseline answer/tool scenarios | 15/15 passed |
| Local-model scenarios | 15/16 passed |
| HTTP API scenarios | 9/9 passed |
| Production build | Passed |
| npm dependency audit | 0 vulnerabilities reported |

Raw observations: [baseline](evaluation/baseline.json), [local models](evaluation/local-models.json), [HTTP API](evaluation/api.json). The availability clock is fixed in pipeline evaluations for repeatability. HTTP tests use future dates relative to the run.

The baseline covers all example questions from the assignment, missing details, ambiguity, unsupported assumptions, room availability, follow-ups, and unknown answers. Separate tests exercise offline providers, invalid model selections, malformed requests, capacity constraints, graph references, and corrupted saved state.

MiniLM, FlashRank, and Laya all loaded in the local run. Answering requests that used the models took approximately **1.6–2.1 seconds** on this machine; median **1.8 seconds**. Cold loading took about 20 seconds after download. These are small development-set observations, not a performance benchmark.

**Known miss:** “Where can I take a dip?” was expected to retrieve the pool but returned the safe fallback. Both trained retrieval scores were weak. The gate was retained rather than lowered to make this example pass. Broader paraphrase evaluation and domain calibration are needed before production. The test runner exits nonzero for this recorded miss.

Laya also ships a calibration warning for a high-cardinality temperature entry. Runtime choices here are small, but confidence is still treated as a bounded signal, not a probability. A regression test prevents low-confidence rejection from being inverted into high relevance.

The OpenAI-compatible request/response contract, valid source selection, malformed selections, and provider failure were tested with controlled responses. A paid provider request was not made because no API key was supplied.

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
