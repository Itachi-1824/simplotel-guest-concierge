# Deployment

Live: https://simplotel.itachi1824.org

The assessment runs on the `polli` VPS under the unprivileged `simplotel` account. Files, dependencies, model weights, provider configuration, and tunnel credentials are contained in `/srv/simplotel`. Existing VPS applications use separate services and directories.

| Component | Location |
| --- | --- |
| Repository | `/srv/simplotel/app` |
| Node 24 runtime | `/srv/simplotel/runtime` |
| Python environment | `/srv/simplotel/app/.venv` |
| Models | `/srv/simplotel/app/.cache` |
| Provider configuration | `/srv/simplotel/app/.env`, mode 600 |
| Tunnel credential | `/srv/simplotel/tunnel.token`, mode 600 |
| Web service | `simplotel-web`, loopback port 4325 |
| Local AI service | `simplotel-ai`, loopback port 8005 |
| HTTPS tunnel | `simplotel-tunnel`, Cloudflare name `simplotel-concierge` |

Service definitions are in `deploy/`. Systemd starts them after reboot and restarts failed processes. Home directories are hidden from the services; system files are read-only. Only the app's cache and Astro storage directories are writable. No new inbound firewall ports are needed.

Pollinations uses the existing OpenAI-compatible adapter:

```dotenv
OPENAI_API_KEY=your-pollinations-secret-key
OPENAI_BASE_URL=https://gen.pollinations.ai/v1
OPENAI_MODEL=openai/gpt-5.4-nano
OPENAI_TIMEOUT_MS=12000
OPENAI_MAX_TOKENS=24000
LOCAL_AI_URL=http://127.0.0.1:8005
```

Use a model permitted by your key. The browser never receives the key. Conversational interpretation and multi-source sentence selection may call the LLM. Date validation, occupancy, prices, and capacity remain deterministic. The API allows 30 requests per client per minute and 200 provider calls per UTC day per process. After the provider allowance is used, sourced local answers and explicit booking requests continue; unfamiliar phrasing may require clarification. These in-memory counters reset on restart; use a shared persistent limiter for a larger deployment.

GPT-5.4 Nano receives an OpenAI-format JSON POST at `https://gen.pollinations.ai/v1/chat/completions`. The deployment allows 24,000 tokens and up to 12 seconds. Timeout, invalid JSON, and truncated output fall back to sourced local answers. It passed all three sampled hotel tasks in the [provider comparison](evaluation/provider-models.json); that report retains the original benchmark settings and selection.

## Update

```sh
sudo -u simplotel git -C /srv/simplotel/app pull --ff-only
cd /srv/simplotel/app
sudo -u simplotel env PATH=/srv/simplotel/runtime/node_modules/node/bin:/usr/local/bin:/usr/bin:/bin npm ci
sudo -u simplotel env PATH=/srv/simplotel/runtime/node_modules/node/bin:/usr/local/bin:/usr/bin:/bin npm run build
sudo systemctl restart simplotel-web
curl -f https://simplotel.itachi1824.org/api/health
```

## Inspect

```sh
systemctl status simplotel-web simplotel-ai simplotel-tunnel
sudo journalctl -u simplotel-web -n 40
curl -f http://127.0.0.1:8005/health
```

## Remove after review

1. Remove the `simplotel.itachi1824.org` published route and its DNS CNAME in Cloudflare, then delete the dedicated `simplotel-concierge` tunnel.
2. Run the commands below only when the assessment is no longer needed.

```sh
sudo systemctl disable --now simplotel-web simplotel-ai simplotel-tunnel
sudo rm /etc/systemd/system/simplotel-web.service /etc/systemd/system/simplotel-ai.service /etc/systemd/system/simplotel-tunnel.service
sudo systemctl daemon-reload
test "$(realpath /srv/simplotel)" = /srv/simplotel && sudo rm -rf -- /srv/simplotel
sudo userdel simplotel
```

The GitHub repository remains available. The original Polli application, services, and provider key are not removed.
