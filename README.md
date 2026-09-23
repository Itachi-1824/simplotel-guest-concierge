# Simplotel Guest Concierge

An Astro + React hotel assistant for questions, room discovery, and sample availability. The Cove Hotel is fictional. This is an independent assessment submission, not an official Simplotel service.

## Run

Requires Node.js 22.12+ and npm. Tested with Node 24.13.1.

```sh
npm ci
npm run dev
```

Open **http://localhost:4321**. The complete frontend and backend work without API keys. Hotel answers use the bundled knowledge base; room availability uses deterministic sample inventory.

## Enable local AI

Python 3.11 or 3.12 is recommended. First installation downloads model weights; allow several minutes and several GB of disk space. CPU inference is supported.

Windows PowerShell:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r model_service/requirements.txt
npm run ai:warmup
npm run dev:ai
```

macOS / Linux:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r model_service/requirements.txt
npm run ai:warmup
npm run dev:ai
```

Stop an existing `npm run dev` before `dev:ai`. The local service loads MiniLM, FlashRank, and Laya on port **8001**. Wait for its “Application startup complete” message. Check model status at **http://127.0.0.1:8001/health**. Downloads are cached in `.cache/`; weights are not committed. If the service is unavailable, the application falls back to built-in retrieval.

## Connect an LLM

Copy `.env.example` to `.env`, then set:

```dotenv
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
```

Restart the app. Any compatible provider must support `/chat/completions` with JSON object responses. The LLM selects relevant sentences for multi-source answers; the server validates selections and renders only hotel evidence. Single-fact answers and availability do not require an LLM. Invalid responses or provider failures return the complete grounded answer.

`LOCAL_AI_URL` can connect a separately running model service. `LAYA_ENABLED=0` disables Laya while retaining local embeddings and reranking. Optional `npm run embeddings` builds a provider embedding index; local MiniLM requires no provider key.

## Check the submission

```sh
npm test
npm run eval
npm run build
npm run test:api
```

`test:api` requires the application running on port 4321. With the local service running:

```sh
npm run eval -- --local
npm run test:python
```

Observed results and known limits are in [Evaluation](docs/evaluation.md). Use [Requirements](docs/requirements.md) to review every PDF requirement. The exploratory local evaluation includes a known unsupported paraphrase and reports it as a failure rather than concealing it.

## Production build

```sh
npm run build
npm start
```

The Node server defaults to port 4321. Set `HOST` and `PORT` as needed. `.env` is loaded at startup. The Python service runs separately for local AI; `LOCAL_AI_URL` must be reachable from the Node server. This application uses the Node adapter, not a static hosting adapter.

## Review in five minutes

1. Ask “What time is check-in?” from the landing page.
2. Ask about the Terrace Suite, then “And breakfast?”
3. Ask “Do you have a helipad?” to see the grounded fallback.
4. Open **Check dates**, choose future dates and three guests.
5. Open the sidebar; rename, file, archive, restore, or export a conversation.
6. Replay the guide from the sidebar footer.

Chats and folders are stored on the current device. Clearing browser storage removes them. No reservation or payment is made.

## Documentation

- [Architecture and decisions](docs/architecture.md)
- [API examples](docs/api.md)
- [Requirement checklist](docs/requirements.md)
- [Evaluation and observed results](docs/evaluation.md)
- [Credits](docs/credits.md)

AI development tools: OpenAI Codex assisted with implementation, research, and testing; OpenAI image generation produced the two hotel illustrations.
