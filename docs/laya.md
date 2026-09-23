# Laya in this application

Laya is a local classifier, not an LLM. The Python service keeps one English checkpoint loaded and asks small `choice` questions. Prices, availability, dates, and payments remain in code.

## Usage checks

The integration uses typed questions with distinct semantic labels, two to five options, and bounded state. It avoids boolean-word labels. The English checkpoint has a short context window; multi-turn preference input is passed as a chronological list so truncation retains the latest turn. Model weights stay cached on the server. These choices follow the [upstream usage guide](https://github.com/NandhaKishorM/laya#single-model-mode-direct-sdk) and its [documented limits](https://github.com/NandhaKishorM/laya#honest-limits).

`confidence` for a choice is normalized entropy, not its probability of being correct. The installed implementation was checked as well as the docs. The application validates the whole score distribution and treats it as evidence for a decision, not proof. The upstream model card also warns that domain performance and calibration need evaluation. [Model card](https://huggingface.co/convaiinnovations/laya).

## What changed after testing

Forty hand-labelled preference requests were split into 20 development cases and 20 held-out cases before tuning. They include synonyms, negations, corrections, unrelated text, and injected classification instructions.

| Check | Before | After |
| --- | --- | --- |
| Raw Laya: both preference labels correct | 22/40 | 22/40 |
| Application preferences after code and classifier checks | 26/40 | 40/40 |
| Development application cases | See raw report | 20/20 |
| Held-out application cases | See raw report | 20/20 |
| Raw intent labels | 14/16 | 14/16 |
| Query selection retained the intended meaning | 6/6 | 6/6 |

The raw classifier did not become more accurate. Explicit preference handling and rejection of uncertain hints improved the application result.

After switching multi-turn state to a chronological list, four fresh real-model probes checked corrections and long histories. All four application results matched the latest request; raw Laya still missed some labels. [History checks](evaluation/laya-history.json).

The acceptance threshold was selected using only development cases. A winning score of at least .90, a margin of .30, and entropy confidence of at least .10 retained four correct positive hints and rejected five incorrect accepted hints. Malformed distributions are rejected. Explicit guest preferences take precedence. A question about breakfast is not a requirement to include it; a balcony is not treated as a terrace.

Intent and query thresholds were kept conservative. Both intent mistakes had very low confidence (.0076 and .0389). Relevance scores remain a small, bounded ranking adjustment. Graph suggestions still require review before becoming active.

## Temperature experiment

A separate scalar was fitted for each preference head by minimizing development-set negative log likelihood. The input was the checkpoint's emitted distribution, so this was an additional temperature, not a raw-logit refit. Held-out negative log likelihood improved slightly, but both fits worsened Brier score and expected calibration error. Neither fit was deployed.

| Head | Held-out ECE before | Candidate fit |
| --- | --- | --- |
| Room view | .064 | .130 |
| Breakfast | .132 | .214 |

The [upstream calibration guidance](https://github.com/NandhaKishorM/laya#calibration) recommends domain evaluation. Twenty held-out examples per head do not establish general calibration. More representative guest data and separate validation would be needed before claiming production accuracy or retraining the model.

## Bounded load check

Twelve mixed analysis and preference requests ran at concurrency two with unique inputs to avoid cache hits. All returned HTTP 200. Median latency was 3.72 seconds and p95 was 5.27 seconds on this four-vCPU VPS. Health checks stayed available. This is a small load probe, not a capacity guarantee. Some inference requests can exceed the application's short timeout; deterministic fallback remains available.

No external LLM calls or credits were used by these checks. The classifier service is bound to loopback.

## Reproduce

```sh
node scripts/stress-laya.mjs
node scripts/calibrate-laya.mjs
node scripts/fit-laya-temperature.mjs
```

The first command requires the local model service and writes a new report. The other two use the recorded before-run by default and never alter live settings.

Evidence: [before](evaluation/laya-stress-before.json), [after](evaluation/laya-stress-after.json), [threshold selection](evaluation/laya-calibration.json), [temperature experiment](evaluation/laya-temperature.json).
