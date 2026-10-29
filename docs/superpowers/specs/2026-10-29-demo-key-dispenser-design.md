# Demo key dispenser: one short-lived OpenRouter key per participant

Date: 2026-10-29. Status: draft for review.

## Intent

A 50-person external workshop runs DeepSeek models through OpenRouter. Participants without their own key need one from us. We have no channel to individuals (no attendee emails, no chat), and we cannot publish anything on a Brevo domain. We want each person to get exactly one key that is worthless after the day, with no speaker typing or reading keys aloud, and with the account-level OpenRouter credentials never leaving the speakers' laptops.

## Goals

- Every participant can get one OpenRouter key in under a minute, from a browser or from the existing `node setup.mjs`.
- Each key is capped at $10 and expires at the end of the workshop day. Nothing a participant keeps is useful tomorrow.
- One key per device. A second claim from the same browser or the same machine returns "already claimed" and no new key.
- The service is reachable on a throwaway URL, not a Brevo hostname.
- The OpenRouter management key (the one that can mint keys) is used only on a speaker laptop, never on the service.
- Everything is deleted the day after, and the keys expire on their own even if we forget.

## Non-goals

- One key per human. Without an attendee list we cannot verify identity. Device binding plus the $10 cap plus a finite pool is the accepted trade. If an attendee email list appears, an email allowlist can be added as a second check without changing the architecture.
- Writing the key into the DeepSeek harness config file. The config path is still `TODO(verify)` in `harness/README.md`. The script saves the key to a known file and prints the two commands to use it.
- Anything that survives the event: no database, no accounts, no dashboards.

## Anti-goals (what would make this a failure even if it works)

- A participant reaches a Brevo SSO or VPN wall.
- The management key, or the full pool file, ends up in git, in a container image layer, in logs, or in the browser.
- The service goes down mid-session with no fallback the speaker can run from a laptop in one command.
- A first-time visitor on conference Wi-Fi is refused because 49 others share the same public IP.

## Constraints

- Scripts and service are plain Node 22+ with no npm dependencies, matching `setup.mjs`. Tests use `node --test`.
- The service runs as one pod on the `devbox` Kubernetes cluster (kube context `kubernetes-admin@devbox`, reachable only on the Brevo VPN from a speaker laptop). It is exposed through a `cloudflared` quick tunnel sidecar, which gives a random `https://<words>.trycloudflare.com` URL and needs no account, DNS, or ingress.
- The workshop repo is `sahilsharma2408/sc-ai-coding-workflows-files` and it is public. We have read access only, so changes arrive as a PR from a fork, stacked on PR #1 (`feat/setup-script`).
- Because the repo is public, nothing Brevo-specific goes into it: no cluster names, kube contexts, VPN mentions, registry paths, or manifests. The public repo gets the scripts, the service, the page, and a generic "run it anywhere with a quick tunnel" README. The devbox manifests and the speaker run-sheet live in a private Brevo repo (location: see open questions).

## OpenRouter facts the design relies on (verified against the docs 2026-10-29)

- `POST https://openrouter.ai/api/v1/keys` with `Authorization: Bearer <management key>` creates a key. Body: `name`, `limit` (USD), `expires_at` (ISO 8601 UTC with seconds, fixed at creation). Response: `key` (plaintext, returned once) and `data.hash`.
- `PATCH /api/v1/keys/{hash}` with `{"disabled": true}` disables a key. `DELETE /api/v1/keys/{hash}` removes it. `GET /api/v1/keys` lists them.
- Expired keys get `401 API key expired` from the inference API. No cleanup call is needed.
- `GET /api/v1/key` with a participant key returns `data.limit_remaining`. `setup.mjs` already uses this.
- Management keys must themselves carry an expiry. Create one that expires the day after the event.

## Architecture

Three pieces, in the workshop repo under `keys/`.

```
Public workshop repo:
keys/
  mint-keys.mjs        speaker laptop: management key in, pool file out
  revoke-keys.mjs      speaker laptop: disable every key in the pool file
  server.mjs           the dispenser; reads the pool, serves the claim page and API
  public/index.html    the claim page (inline CSS and JS, no build step)
  Dockerfile           node:24-alpine, non-root, copies server.mjs and public/
  README.md            generic: how to mint, run the server, open a quick tunnel, revoke
test/keys.test.mjs

Private Brevo repo (see open questions):
workshop-keys/
  k8s/                 Namespace, Deployment, Service; Secrets are created by hand, never committed
  RUNSHEET.md          the day-before / day-of / day-after checklist with cluster details
```

`setup.mjs` gains a `--claim <url>` option that calls the dispenser.

### 1. Mint (before the day, speaker laptop)

`OPENROUTER_MANAGEMENT_KEY=... node keys/mint-keys.mjs --count 55 --limit 10 --expires 2026-11-05T22:00:00Z --out pool.json`

- Creates `count` keys named `workshop-2026-11-05-001` and so on, each with the given `limit` and `expires_at`.
- Writes `pool.json`: `{ "event": "...", "expires_at": "...", "keys": [ { "id": 1, "hash": "...", "key": "sk-or-..." }, ... ] }`.
- `pool.json` is listed in `.gitignore`. The file is the only copy of the plaintext keys. The speaker keeps it until the day after, then deletes it.
- Spares: mint 55, load 50 into the service, keep 5 in the file for hand-outs if the pool runs dry or the service dies. The speaker reads a spare from the file and shows it to one person on a laptop screen.
- Idempotence: if `--out` exists the script refuses, so a re-run cannot double-mint.

### 2. Revoke (any time, speaker laptop)

`OPENROUTER_MANAGEMENT_KEY=... node keys/revoke-keys.mjs --pool pool.json`

- `PATCH` each hash with `disabled: true`. Reports counts. Safe to run twice.
- Normal cleanup is expiry; this exists for "stop everything now".

### 3. Dispenser (`server.mjs`)

A single-process HTTP server. Claim state is in memory and written to `STATE_FILE` after every change. `STATE_FILE` is loaded at start if present, so a container restart keeps claims. A pod replacement or the laptop fallback loses the `emptyDir`, so the state is also exportable: `GET /state` (speaker token) returns the claims JSON, and the server accepts `STATE_IMPORT` pointing at such a file at start. The run-sheet exports state before any redeploy and before switching to the laptop. If the speaker forgets, the server hands out keys that are already in someone's hands, and that is the accepted failure (two people sharing one $10 key).

Config via env:

| Var | Meaning |
|---|---|
| `POOL_FILE` | path of the mounted pool (Secret). Read once at start. |
| `EVENT_CODE` | the word the speaker says aloud. Compared constant-time. |
| `DEVICE_SALT` | random per event. Hashes device identifiers before storing. |
| `STATE_FILE` | where claims are persisted (emptyDir). |
| `STATS_TOKEN` | bearer token for `GET /stats`. |
| `PORT` | default 8080. |

Routes:

- `GET /` serves the claim page.
- `POST /claim` body `{ "code": "...", "device": "..." }`. Returns `201 { "key": "sk-or-...", "id": 17 }` on first claim, `409 { "error": "already_claimed" }` for a known device, `403` for a wrong code, `429` when throttled, `503 { "error": "pool_empty" }` when the pool is used up.
- `GET /stats` with `Authorization: Bearer $STATS_TOKEN`: `{ "total": 50, "claimed": 23, "remaining": 27 }`. Speaker only.
- `GET /state` with the same token: the full claims file (salted device hashes and key ids, no keys). Speaker only. Used to carry state across a redeploy or to the laptop fallback.
- `GET /healthz` for the kubelet.

Device binding:

- The browser generates 32 random bytes on first visit, stores them in `localStorage` and a `SameSite=Strict` cookie, and sends the value as `device`. Either store surviving is enough to block a repeat.
- The browser identity and the script identity are different, so one laptop can get one key through each path. That is accepted: the page and the script both say "use one path, not both", the pool is sized with headroom, and the cap and expiry bound the cost. Making the two paths share an identity is not worth the complexity for a one-day event.
- The script sends `sha256(machine identifier)` where the identifier is `/etc/machine-id` on Linux, `IOPlatformUUID` on macOS, and `MachineGuid` on Windows, falling back to hostname plus home directory. The server hashes again with `DEVICE_SALT` before storing, so neither raw hardware IDs nor the client hash are persisted.
- Claims are keyed on the salted hash. A repeat returns `409` and never a key, including the original one. The page tells the person to ask a speaker, who can hand a spare.

Throttling and abuse:

- Throttles must never refuse a first-time claimer behind conference NAT. The moment the code is read out, 50 people on one IP claim within the same minute, so nothing per-IP may be tighter than that.
- Per-IP token bucket: 120 claim attempts per minute per IP. This only stops a scripted loop.
- Global: 600 requests per minute total across all routes. Above that the server returns `429` until the bucket refills.
- Wrong event code: lockout is per device, not per IP. After 10 wrong codes from one device hash, that device gets `429` for 5 minutes. A room full of typos never locks out the room.
- Body size capped at 1 KB. Only `POST /claim` accepts a body.
- No key is ever logged. Logs carry the claim id, the salted device hash prefix, the IP, and the outcome.
- The pool file is read once and the plaintext keys are held only in process memory. `/stats` and logs expose counts and hashes, never keys.

### 4. Claim page (`public/index.html`)

One screen. A text field for the event code, a button, a result box. On success it shows the key once, in a code block with a copy button, and the three ways to use it:

1. `node setup.mjs --claim <this URL>` (does this automatically)
2. `export OPENROUTER_API_KEY=...` for the harness
3. paste into the harness under Settings → Models

The page never re-shows a key after reload. It shows "You already have a key on this device. Ask a speaker if you lost it."

### 5. `setup.mjs --claim <url>`

- `--claim` is a short, claim-only path. It runs the Node check and the OpenRouter check, then claims, validates, saves and exits. It does not download the harness, run `npm ci`, or create the project, so it is safe on conference Wi-Fi. The slide shows `node setup.mjs --claim <url>`.
- The event code comes from `--code <word>`, or `WORKSHOP_CODE` in the environment, or a hidden interactive prompt when neither is set and a TTY is present. Tests and copy-pasted one-liners use `--code`.
- Posts the device hash and the code.
- On `201`: validates the key against `/api/v1/key` exactly like a pasted key, prints it once, and writes it to `~/.workshop/openrouter.env` as `OPENROUTER_API_KEY=...` with mode `0600`. The summary tells the person to `source ~/.workshop/openrouter.env`.
- On later runs, `setup.mjs` reads that file if `OPENROUTER_API_KEY` is unset, so `--check` on the day reports the key as valid without a prompt.
- On `409`: prints the already-claimed message and the saved file path if present.
- This is the one deliberate change to the existing promise "the key is never written to disk". The README and the in-script notice change to: a workshop key is saved to one file in your home directory, mode 0600, and you can delete it after the event. The existing tests that assert the key is not written are scoped to the paste path and keep passing.

### 6. Deployment on devbox

- Preflight, the week before, before writing any manifest: run a single `cloudflare/cloudflared` pod on devbox with `tunnel --url http://localhost:8080` and confirm it prints a trycloudflare.com URL. That proves image pull and egress to Cloudflare's edge in one step. If it fails, the laptop fallback becomes the primary plan and the k8s part is dropped.
- The dispenser image is pushed to the registry devbox already pulls from (see open questions). Image tag pinned by digest in the manifest.
- Namespace `workshop-keys`, deleted the day after.
- Secret `pool` created by the speaker with `kubectl create secret generic pool --from-file=pool.json` over the VPN. Never in git.
- Secret `dispenser-env` with `EVENT_CODE`, `DEVICE_SALT`, `STATS_TOKEN`.
- Deployment with two containers: `dispenser` (image built from `keys/Dockerfile`, `node:24-alpine`, copies `server.mjs` and `public/`, runs as non-root, read-only root filesystem, no capabilities) and `cloudflared` (`cloudflare/cloudflared:latest`, `tunnel --no-autoupdate --url http://localhost:8080`). One replica. State on an `emptyDir` shared by nobody else.
- The tunnel URL is read from the `cloudflared` container logs once at start and put on the slide. A pod restart gives a new URL, so the Deployment uses `Recreate` and the speaker checks the URL at the start of the session.
- Resource requests 50m CPU and 64Mi memory per container, limits 200m and 128Mi. Devbox Gatekeeper requires limits.
- No ingress, no Service of type LoadBalancer. A `ClusterIP` Service exists only so the speaker can `kubectl port-forward` to `/stats`.

Fallback if devbox or the VPN fails on the day: export `/state` if the pod is still reachable, then `STATE_IMPORT=state.json node keys/server.mjs` and `cloudflared tunnel --url http://localhost:8080` on the speaker laptop with the same env. New URL on the slide. Same code, documented in `keys/README.md` (generic) and `RUNSHEET.md` (Brevo specifics).

### 7. Run-sheet (`keys/README.md`)

Day before: create management key with expiry, mint, create secrets, deploy, read URL, test one claim from a phone on mobile data, revoke that test key manually or accept the loss. Any redeploy after that: export `/state` first, import it on the new pod via the `STATE_IMPORT` secret.
Day of: show URL plus QR and say the code, watch `/stats`, hand spares from `pool.json` if asked.
Day after: `kubectl delete ns workshop-keys`, delete `pool.json`, delete the management key in the OpenRouter dashboard.

## Security summary

| Threat | Handling |
|---|---|
| Management key exposure | Only in a speaker shell env for the mint and revoke commands. Never in the pod, image, repo, or page. |
| Pool file exposure | Kubernetes Secret, mounted read-only, read once. Not in git. Deleted after. |
| Someone claims several keys | Device-bound claims, per-IP and global throttles, finite pool, $10 cap, same-day expiry. Residual risk accepted. |
| Scraper drains the pool | Event code required, 20-failure lockout, 200 requests per minute global cap. Pool exhaustion is visible on `/stats`. |
| Key leaks after the event | Expiry at end of day. `revoke-keys` for earlier. |
| Brevo surface exposed | None. Random trycloudflare.com hostname, no Brevo DNS, no ingress on the cluster. |
| Participant laptop | Key saved in one `0600` file, printed once, validated before saving. |

## Testing

- `test/keys.test.mjs` with `node --test`: unit tests for the pool loader, device hashing, token buckets, and claim state; integration tests that start `server.mjs` on a random port with a 3-key pool and assert: first claim 201, repeat 409, wrong code 403, lockout 429, pool empty 503, `/stats` needs the token, keys never appear in logs. Mint and revoke are tested against a fake OpenRouter server, like the existing `setup.mjs` tests.
- `setup.mjs --claim` is tested against the fake dispenser: file written with mode `0600`, key never printed twice, `409` handled.
- Manual: one real mint of 2 keys against OpenRouter with `--limit 1`, one claim end to end through a real quick tunnel from a phone on mobile data.

## Left to the builder

- Exact token bucket implementation and the state file format.
- How `cloudflared` logs are parsed for the URL (a documented `kubectl logs | grep trycloudflare` is fine).
- The look of the claim page, beyond: one field, one button, works on a phone, key in a code block with a copy button.
- QR code generation: a static tool the speaker runs by hand is fine, it does not need to be in the service.

## Decisions made by the author (Claude), not by the team

- Pool rather than live minting, so the management key never reaches the service.
- Quick tunnel sidecar rather than a Worker, to keep state and code on devbox and avoid any external account.
- Device binding rather than per-IP, because of conference NAT.
- The key is saved to one file on the participant machine when claimed through the script, which changes PR #1's "never written to disk" promise for that path only.
- 60 minted, 50 loaded, 10 spares kept in the file, because the browser and script paths can each yield a key per laptop.
- Claim state is carried across redeploys by export and import rather than by a persistent volume, to keep the cluster footprint to one Secret-backed pod.
- `--claim` is claim-only and takes `--code`, so the slide command works without a TTY and on conference Wi-Fi.
- Lockout for wrong codes is per device, and per-IP limits are loose enough for 50 people behind one NAT.
- Nothing Brevo-specific goes to the public workshop repo.

## Open questions for the team

1. Which registry does devbox pull from, and does it need a pull secret? Needed for the Deployment image reference. If unknown, the preflight pod will tell us whether a public Docker Hub image is pullable, and we can push the dispenser image to Docker Hub under a throwaway account.
2. Which private Brevo repo holds `workshop-keys/k8s/` and `RUNSHEET.md`? Default if unanswered: a `tools/workshop-keys/` directory in `brevo-agent`.
