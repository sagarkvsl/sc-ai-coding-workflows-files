# Workshop key dispenser

Hands out one short-lived OpenRouter key per participant device, so people without their own key can run the DeepSeek stages. Keys are minted ahead of time with a spending cap and an expiry, loaded into a small server, and claimed through a web page or `node setup.mjs --claim`. The OpenRouter management key, which can mint keys, is used only on a speaker laptop and never reaches the server.

Everything here is plain Node 22+ with no dependencies: `node --test test/keys.test.mjs` runs the tests.

## 1. Mint the pool (speaker laptop, before the day)

Create a **management key** in the OpenRouter dashboard with an expiry a day after the event. Then:

```bash
OPENROUTER_MANAGEMENT_KEY=... node keys/mint-keys.mjs --count 60 --limit 10 --expires 2026-11-05T22:00:00Z --out pool.json
```

- `--limit` is the cap per key in USD, `--expires` is when every key stops working (ISO 8601 UTC with seconds).
- `pool.json` is the only copy of the keys, written with mode 0600 and listed in `.gitignore`. The script refuses to overwrite an existing file.
- Mint more than you need. The server loads the first `POOL_LOAD` keys (default 50); the rest are spares you hand out by hand if someone loses theirs or the pool runs dry.

## 2. Run the server

```bash
POOL_FILE=pool.json POOL_LOAD=50 \
EVENT_CODE=tulip DEVICE_SALT=$(openssl rand -hex 32) STATS_TOKEN=$(openssl rand -hex 32) \
STATE_FILE=state.json PORT=8080 node keys/server.mjs
```

| Variable | Meaning |
|---|---|
| `POOL_FILE` | The pool from step 1. Read once at start; keys stay in memory only. |
| `POOL_LOAD` | How many keys from the pool to hand out (default 50). |
| `EVENT_CODE` | The word you say aloud. Required on every claim. |
| `DEVICE_SALT` | Random per event. Device identifiers are hashed with it before being stored. |
| `STATS_TOKEN` | Bearer token for `GET /stats` and `GET /state`. |
| `STATE_FILE` | Where claims are saved, so a restart keeps them. Contains hashes and key ids, never keys. |
| `STATE_IMPORT` | Optional: a file from `GET /state` to seed claims on a fresh machine. |
| `PORT` | Default 8080. |

Routes: `GET /` the claim page, `POST /claim` (`{ "code", "device" }`), `GET /stats` and `GET /state` (speaker token), `GET /healthz`.

## 3. Expose it on a throwaway URL

```bash
cloudflared tunnel --no-autoupdate --url http://localhost:8080
```

This prints a random `https://<words>.trycloudflare.com` address that works as long as the process runs. Put it on a slide, as text and as a QR code, and say the event code. No account or DNS is needed. The URL changes every time the tunnel restarts, so check it right before the session.

## 4. Watch and move state

```bash
curl -H "Authorization: Bearer $STATS_TOKEN" https://<url>/stats      # { total, claimed, remaining }
curl -H "Authorization: Bearer $STATS_TOKEN" https://<url>/state > state.json
```

Before restarting the server somewhere else (a different machine, a redeploy), export `/state` and start the new server with `STATE_IMPORT=state.json`. Otherwise the new server does not know which keys are taken and may hand one out twice.

## 5. Revoke early (optional)

Keys expire on their own at `--expires`. To stop everything sooner:

```bash
OPENROUTER_MANAGEMENT_KEY=... node keys/revoke-keys.mjs --pool pool.json
```

Afterwards delete `pool.json` and delete the management key in the OpenRouter dashboard.

## What stops abuse, and what does not

- One key per device: the page stores a random device token, the script hashes a machine identifier, and the server refuses a second claim from the same hash. A person can defeat this by clearing storage or using both the page and the script, so mint spares and size the pool with headroom.
- The event code, a per-device lockout after 10 wrong codes, loose per-IP and global rate limits (conference Wi-Fi puts everyone behind one address, so per-IP limits are deliberately generous), and a 1 KB request body cap.
- The real limit is money and time: every key is capped and dies at the expiry. Treat the pool as spent the moment it is minted.
- Keys never appear in logs, in `/stats`, or in `/state`.
