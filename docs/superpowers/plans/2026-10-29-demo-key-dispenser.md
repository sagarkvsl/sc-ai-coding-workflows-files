# Demo Key Dispenser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each of 50 external workshop participants one $10, same-day OpenRouter key through a throwaway URL, with the OpenRouter management key never leaving a speaker laptop.

**Architecture:** Two speaker-side scripts mint and revoke a pool of keys via the OpenRouter provisioning API. A dependency-free Node HTTP server holds the pool in memory, serves a claim page and a `/claim` API, and binds each key to one device hash. The server runs on the devbox cluster behind a `cloudflared` quick-tunnel sidecar; `setup.mjs` gains a claim-only `--claim` path.

**Tech Stack:** Node 22+ built-ins only (`node:http`, `node:crypto`, `node:fs`), `node --test`, Kubernetes manifests applied with `kubectl`, `cloudflare/cloudflared` image.

**Spec:** `docs/superpowers/specs/2026-10-29-demo-key-dispenser-design.md`

## Global Constraints

- Node 22+ with no npm dependencies anywhere; tests run with `node --test`.
- Two repos. Public workshop repo (`sahilsharma2408/sc-ai-coding-workflows-files`, branch stacked on `feat/setup-script`, PR from a fork): `keys/`, `test/keys.test.mjs`, `setup.mjs` changes, READMEs. Private `brevo-agent` repo (`/Users/sagarpuri/Documents/DTSL/brevo-code/brevo-agent`, new branch off `main`): `tools/workshop-keys/`.
- Nothing Brevo-specific in the public repo: no cluster names, kube contexts, VPN, registries.
- The management key is read only from `OPENROUTER_MANAGEMENT_KEY` in the mint and revoke scripts. It never appears in any other file, log, or test fixture (tests use `mgmt-test-key`).
- No plaintext participant key is ever logged by the server or printed twice by the setup script.
- `pool.json`, `state.json`, and `~/.workshop/openrouter.env` are never committed; `pool.json` and `state.json` go in `.gitignore`.
- Spec values: per-key `limit` 10 USD; mint 60, server loads the first 50 (`POOL_LOAD=50`), spares are ids 51 to 60; per-IP bucket 120 claims per minute; global bucket 600 requests per minute; per-device lockout after 10 wrong codes for 5 minutes; request body cap 1024 bytes; device hash `sha256(DEVICE_SALT + ":" + device)`.
- Copy fixed by the spec: already-claimed page text "You already have a key on this device. Ask a speaker if you lost it."; both page and script say "Use one path, not both."

## Review Focus

- Behind `cloudflared`, every request's socket address is localhost. The server must take the client IP from the `cf-connecting-ip` header first, or every participant shares one bucket. Test added to Task 4.
- A `POST /claim` with a malformed JSON body, a missing `device`, or a `device` longer than 128 characters must return `400`, not crash the only process. Test added to Task 4.
- A pool file with duplicate ids or a missing `key` must make the server refuse to start with a clear message, not hand out `undefined`. Test added to Task 3.
- `STATE_FILE` on a read-only or missing directory must not lose a claim silently: the claim still succeeds in memory and the error is logged once. Test added to Task 3.
- `setup.mjs --claim` with `--code` given but no TTY must not block on the hidden prompt, and a `409` must exit 0 with the saved file path shown. Test added to Task 6.

---

### Task 1: Mint script

**Files:**
- Create: `keys/openrouter.mjs`, `keys/mint-keys.mjs`
- Modify: `.gitignore` (add `pool.json`, `state.json`)
- Test: `test/keys.test.mjs`

**Interfaces:**
- Produces `keys/openrouter.mjs`: `createClient({ baseUrl, managementKey }) -> { createKey({ name, limit, expiresAt }) -> Promise<{ key, hash }>, disableKey(hash) -> Promise<void> }`. `baseUrl` defaults to `process.env.WORKSHOP_OPENROUTER_API ?? 'https://openrouter.ai/api/v1'`.
- Produces `keys/mint-keys.mjs`: `parseMintArgs(argv) -> { count, limit, expires, out, prefix }` (defaults: `count` 60, `limit` 10, `prefix` `workshop`, `out` `pool.json`; `expires` required, must parse as ISO 8601 with seconds) and `mint(client, opts) -> Promise<Pool>` where `Pool = { event: string, expires_at: string, keys: Array<{ id: number, hash: string, key: string }> }` with ids 1..count and names `` `${prefix}-${String(id).padStart(3, '0')}` ``.
- Produces the pool file format above, consumed by Tasks 2, 3, 7.

- [ ] **Step 1: Write the failing tests**

In `test/keys.test.mjs`, a `before` hook starts a fake OpenRouter `createServer` on `127.0.0.1:0` that records every request and answers `POST /api/v1/keys` with `201 { key: 'sk-or-fake-' + n, data: { hash: 'hash-' + n } }` only when `authorization === 'Bearer mgmt-test-key'`, else `401`. Then:

```js
test('mint creates count keys with limit and expiry and writes pool.json', async () => {
  const pool = await mint(createClient({ baseUrl, managementKey: 'mgmt-test-key' }),
    { count: 3, limit: 10, expires: '2026-11-05T22:00:00Z', prefix: 'workshop' });
  assert.equal(pool.keys.length, 3);
  assert.deepEqual(pool.keys.map((k) => k.id), [1, 2, 3]);
  assert.equal(pool.keys[0].key, 'sk-or-fake-1');
  const body = JSON.parse(requests[0].body);
  assert.deepEqual(body, { name: 'workshop-001', limit: 10, expires_at: '2026-11-05T22:00:00Z' });
});
test('mint refuses to overwrite an existing --out file', ...);   // run as a child process with --out pointing at an existing file; expect exit 1 and /already exists/ on stderr, zero requests to the fake server
test('mint rejects a missing or malformed --expires', ...);        // parseMintArgs throws /--expires/
test('mint fails fast on 401 and writes nothing', ...);            // wrong management key: rejects, out file absent
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/keys.test.mjs`
Expected: FAIL, cannot find module `keys/mint-keys.mjs`

- [ ] **Step 3: Implement `keys/openrouter.mjs` and `keys/mint-keys.mjs`**

`mint-keys.mjs` follows the `setup.mjs` pattern: exported functions, `main()` guarded by the `import.meta.url` check, management key from `process.env.OPENROUTER_MANAGEMENT_KEY` (exit 2 with a message if unset). Write the pool with mode `0o600`. Add `pool.json` and `state.json` to `.gitignore` under the secrets section.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/keys.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add keys/openrouter.mjs keys/mint-keys.mjs test/keys.test.mjs .gitignore
git commit -m "feat(keys): mint a pool of capped, expiring OpenRouter keys"
```

### Task 2: Revoke script

**Files:**
- Create: `keys/revoke-keys.mjs`
- Test: `test/keys.test.mjs`

**Interfaces:**
- Consumes `createClient` and the pool format from Task 1.
- Produces `revoke(client, pool) -> Promise<{ disabled: number, failed: number }>`; CLI `node keys/revoke-keys.mjs --pool pool.json`.

- [ ] **Step 1: Write the failing tests**

Extend the fake server: `PATCH /api/v1/keys/:hash` with body `{ disabled: true }` answers `200`; `hash-2` answers `500` once to exercise `failed`.

```js
test('revoke disables every hash in the pool and reports counts', async () => {
  const result = await revoke(client, { keys: [{ id: 1, hash: 'hash-1' }, { id: 2, hash: 'hash-2' }, { id: 3, hash: 'hash-3' }] });
  assert.deepEqual(result, { disabled: 2, failed: 1 });
  assert.ok(requests.every((r) => r.method !== 'PATCH' || JSON.parse(r.body).disabled === true));
});
test('revoke is safe to run twice', ...);   // second run: disabled 3, failed 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/keys.test.mjs`
Expected: FAIL, cannot find module `keys/revoke-keys.mjs`

- [ ] **Step 3: Implement `keys/revoke-keys.mjs`**

Sequential PATCHes, continue on error, print the counts, exit 1 if `failed > 0`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/keys.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add keys/revoke-keys.mjs test/keys.test.mjs
git commit -m "feat(keys): revoke every key in a pool"
```

### Task 3: Dispenser core (pool, claims, hashing, buckets)

**Files:**
- Create: `keys/server.mjs`
- Test: `test/keys.test.mjs`

**Interfaces:**
- Produces, all exported from `keys/server.mjs`:
  - `loadPool(json: string, load: number) -> Array<{ id, key }>`: first `load` keys ordered by id; throws `Error('pool: duplicate id N')` or `Error('pool: key N has no key')`.
  - `hashDevice(salt: string, device: string) -> string` (hex sha256 of `salt + ':' + device`).
  - `createClaims({ stateFile, importFile, log }) -> { claim(deviceHash, pool) -> { status: 'issued', id, key } | { status: 'already_claimed' } | { status: 'pool_empty' }, stats() -> { total, claimed, remaining }, export() -> { claims: { [deviceHash]: id } } }`. `claim` persists to `stateFile` after each issue; a write failure is logged once via `log` and does not fail the claim. `importFile`, when set and present, seeds the claims before `stateFile`.
  - `createBucket({ capacity, perMinute }) -> { take(key: string) -> boolean }` token bucket keyed by string.
  - `createLockout({ maxFailures: 10, minutes: 5 }) -> { fail(key) -> void, locked(key) -> boolean }`.
- Consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

```js
test('loadPool takes the first N by id and rejects bad pools', () => {
  const json = JSON.stringify({ keys: [{ id: 2, key: 'b' }, { id: 1, key: 'a' }, { id: 3, key: 'c' }] });
  assert.deepEqual(loadPool(json, 2).map((k) => k.id), [1, 2]);
  assert.throws(() => loadPool(JSON.stringify({ keys: [{ id: 1, key: 'a' }, { id: 1, key: 'b' }] }), 2), /duplicate id 1/);
  assert.throws(() => loadPool(JSON.stringify({ keys: [{ id: 1 }] }), 1), /key 1 has no key/);
});
test('hashDevice is salted sha256', () => {
  assert.equal(hashDevice('s', 'd'), createHash('sha256').update('s:d').digest('hex'));
});
test('claims issue once per device, then already_claimed, then pool_empty', () => {
  const claims = createClaims({ stateFile: path.join(tmp, 'state.json'), log: () => {} });
  const pool = [{ id: 1, key: 'k1' }, { id: 2, key: 'k2' }];
  assert.deepEqual(claims.claim('A', pool), { status: 'issued', id: 1, key: 'k1' });
  assert.deepEqual(claims.claim('A', pool), { status: 'already_claimed' });
  assert.equal(claims.claim('B', pool).id, 2);
  assert.deepEqual(claims.claim('C', pool), { status: 'pool_empty' });
  assert.deepEqual(claims.stats(), { total: 2, claimed: 2, remaining: 0 });
  assert.deepEqual(JSON.parse(readFileSync(path.join(tmp, 'state.json'), 'utf8')), { claims: { A: 1, B: 2 } });
});
test('claims reload from stateFile and from importFile', ...);       // new createClaims on the same stateFile: 'A' is already_claimed, stats.claimed 2; importFile alone seeds the same
test('an unwritable stateFile logs once and still issues', () => {
  const logs = [];
  const claims = createClaims({ stateFile: '/nonexistent/dir/state.json', log: (m) => logs.push(m) });
  assert.equal(claims.claim('A', [{ id: 1, key: 'k1' }]).status, 'issued');
  assert.equal(claims.claim('B', [{ id: 1, key: 'k1' }, { id: 2, key: 'k2' }]).status, 'issued');
  assert.equal(logs.filter((m) => /state/.test(m)).length, 1);
});
test('bucket allows capacity then refuses, lockout trips after 10 failures', ...);   // createBucket({ capacity: 2, perMinute: 2 }): take('x') true, true, false; createLockout: 9 fails not locked, 10th locked
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/keys.test.mjs`
Expected: FAIL, cannot find module `keys/server.mjs`

- [ ] **Step 3: Implement the five functions in `keys/server.mjs`**

Token bucket: refill `perMinute / 60000` tokens per millisecond on each `take`, cap at `capacity`. The state file is written atomically (write to `.tmp` then rename). The file never contains keys, only `{ claims: { [hash]: id } }`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/keys.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add keys/server.mjs test/keys.test.mjs
git commit -m "feat(keys): dispenser core: pool, claims, device hashing, buckets"
```

### Task 4: Dispenser HTTP server

**Files:**
- Modify: `keys/server.mjs`
- Test: `test/keys.test.mjs`

**Interfaces:**
- Consumes Task 3's functions.
- Produces `createDispenser(config) -> http.Server` where `config = { pool, eventCode, deviceSalt, statsToken, claims, publicDir, log, ipBucket?, globalBucket?, lockout? }` (the three optional fields default to `createBucket({ capacity: 120, perMinute: 120 })`, `createBucket({ capacity: 600, perMinute: 600 })`, `createLockout({ maxFailures: 10, minutes: 5 })` and exist so tests can tighten them), and `main()` that builds `config` from env `POOL_FILE`, `POOL_LOAD` (default 50), `EVENT_CODE`, `DEVICE_SALT`, `STATS_TOKEN`, `STATE_FILE`, `STATE_IMPORT` (optional), `PORT` (default 8080), exits 2 naming any missing required var, and listens.
- HTTP contract consumed by Tasks 5 and 6:
  - `GET /` → `200 text/html` from `publicDir/index.html`.
  - `POST /claim` JSON `{ code, device }` → `201 { key, id }` | `403 { error: 'wrong_code' }` | `409 { error: 'already_claimed' }` | `503 { error: 'pool_empty' }` | `429 { error: 'throttled' }` | `400 { error: 'bad_request' }`.
  - `GET /stats`, `GET /state` with `Authorization: Bearer <statsToken>` → `200` JSON, else `401`.
  - `GET /healthz` → `200 ok`. Anything else `404`.

- [ ] **Step 1: Write the failing tests**

A helper `startDispenser(overrides)` creates a 3-key pool, `createClaims` on a temp dir, a capturing `log`, listens on `127.0.0.1:0`, and returns `{ url, logs, close }`. Helper `claim(url, body, headers)` posts JSON and returns `{ status, body }`.

```js
test('claim flow: 201 once per device, 409 on repeat, 403 wrong code, 503 when empty', async () => {
  const { url } = await startDispenser();
  const first = await claim(url, { code: 'tulip', device: 'A' });
  assert.equal(first.status, 201); assert.equal(first.body.id, 1); assert.match(first.body.key, /^k/);
  assert.equal((await claim(url, { code: 'tulip', device: 'A' })).status, 409);
  assert.equal((await claim(url, { code: 'wrong', device: 'B' })).status, 403);
  await claim(url, { code: 'tulip', device: 'B' }); await claim(url, { code: 'tulip', device: 'C' });
  assert.equal((await claim(url, { code: 'tulip', device: 'D' })).status, 503);
});
test('bad bodies return 400', ...);   // non-JSON, {} , device of 129 chars, body of 2000 bytes → 400 each; server still answers /healthz 200
test('client IP comes from cf-connecting-ip, so two tunnel clients get separate buckets', async () => {
  const { url } = await startDispenser({ ipBucket: { capacity: 1, perMinute: 1 } });
  assert.equal((await claim(url, { code: 'tulip', device: 'A' }, { 'cf-connecting-ip': '1.1.1.1' })).status, 201);
  assert.equal((await claim(url, { code: 'tulip', device: 'B' }, { 'cf-connecting-ip': '2.2.2.2' })).status, 201);
  assert.equal((await claim(url, { code: 'tulip', device: 'C' }, { 'cf-connecting-ip': '1.1.1.1' })).status, 429);
});
test('ten wrong codes lock that device only', ...);   // device X: 10 × 403 then 429; device Y with the right code still 201
test('/stats and /state need the token and never contain keys', async () => {
  assert.equal((await get(url + '/stats')).status, 401);
  const stats = await get(url + '/stats', { authorization: 'Bearer tok' });
  assert.deepEqual(stats.body, { total: 3, claimed: 0, remaining: 3 });
  const state = await get(url + '/state', { authorization: 'Bearer tok' });
  assert.ok(!JSON.stringify(state.body).includes('k1'));
});
test('logs never contain a key', async () => { /* after an issued claim: assert.ok(!logs.join('\n').includes(issuedKey)) */ });
test('main exits 2 naming a missing env var', ...);   // spawn server.mjs with EVENT_CODE unset: exit 2, stderr /EVENT_CODE/
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/keys.test.mjs`
Expected: FAIL, `createDispenser is not a function`

- [ ] **Step 3: Implement `createDispenser` and `main` in `keys/server.mjs`**

Client IP: `req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress`. Event code compared with `timingSafeEqual` on equal-length buffers. Global bucket keyed `'*'` checked before anything else. Order inside `/claim`: body parse → global bucket → ip bucket → device lockout → code check (failure feeds lockout) → `claims.claim`. Log one line per request: method, path, status, ip, first 8 chars of the device hash, claim id if any.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/keys.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add keys/server.mjs test/keys.test.mjs
git commit -m "feat(keys): dispenser HTTP server with device binding and throttles"
```

### Task 5: Claim page

**Files:**
- Create: `keys/public/index.html`
- Test: `test/keys.test.mjs`

**Interfaces:**
- Consumes `POST /claim` from Task 4 at the relative URL `claim`.
- Produces the page the server serves at `/`.

- [ ] **Step 1: Write the failing tests**

```js
test('GET / serves the claim page with the fixed copy', async () => {
  const res = await fetch(url + '/');
  const html = await res.text();
  assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.match(html, /You already have a key on this device\. Ask a speaker if you lost it\./);
  assert.match(html, /Use one path, not both\./);
  assert.match(html, /node setup\.mjs --claim/);
  assert.match(html, /fetch\('claim'/);           // relative URL, works behind any hostname
  assert.ok(!/https?:\/\/[a-z]+\.brevo\./.test(html));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/keys.test.mjs`
Expected: FAIL, 404 or copy not found

- [ ] **Step 3: Write `keys/public/index.html`**

One file, inline CSS and JS, phone-width first. Behaviour: on load, read `device` from `localStorage` or the `wk_device` cookie, else `crypto.getRandomValues(new Uint8Array(32))` as hex, store in both (`SameSite=Strict`). If `localStorage.wk_claimed` is set, show the already-claimed text and no form. Form: one input for the code, one button. On `201`: set `wk_claimed`, show the key once in a `<code>` block with a copy button, and the three ways to use it (`node setup.mjs --claim <this page's origin> --code <code>`, `export OPENROUTER_API_KEY=...`, paste under Settings → Models), plus "Use one path, not both." Map `403` → "Wrong event code.", `409` → the already-claimed text, `503` → "No keys left. Ask a speaker.", `429` → "Too many attempts. Wait a minute."

- [ ] **Step 4: Run tests and look at it**

Run: `node --test test/keys.test.mjs` → PASS. Then `POOL_FILE=... EVENT_CODE=tulip DEVICE_SALT=x STATS_TOKEN=t STATE_FILE=/tmp/s.json node keys/server.mjs` with a 2-key fake pool, open `http://127.0.0.1:8080`, claim, reload, confirm the already-claimed text.

- [ ] **Step 5: Commit**

```bash
git add keys/public/index.html test/keys.test.mjs
git commit -m "feat(keys): claim page"
```

### Task 6: `setup.mjs --claim`

**Files:**
- Modify: `setup.mjs` (`HELP`, `parseArgs`, `checkOpenRouter`, `printSummary`, `main`)
- Modify: `README.md` section "3. Models and keys"
- Test: `test/setup.test.mjs`

**Interfaces:**
- Consumes `POST /claim` from Task 4.
- Produces in `setup.mjs`: `parseArgs` gains `claim: string | null` (`--claim <url>`) and `code: string | null` (`--code <word>`, else `process.env.WORKSHOP_CODE ?? null`); exported `deviceId() -> string` (sha256 hex of the machine identifier: `/etc/machine-id` on Linux, `IOPlatformUUID` from `ioreg -rd1 -c IOPlatformExpertDevice` on macOS, `MachineGuid` from `reg query HKLM\SOFTWARE\Microsoft\Cryptography` on Windows, fallback `os.hostname() + os.homedir()`); exported `KEY_FILE = path.join(os.homedir(), '.workshop', 'openrouter.env')`; `claimKey(opts) -> Promise<void>`.
- Behaviour: when `opts.claim` is set, `main` runs `checkNode`, then `claimKey`, then `printSummary`, and nothing else. `claimKey` gets the code from `opts.code` or the hidden prompt (if `canAsk`), else records a `fail` "event code missing, pass --code". On `201` it validates the key against `/api/v1/key` like a pasted key, prints it once, writes `KEY_FILE` as `OPENROUTER_API_KEY=<key>\n` with mode `0o600` (creating `~/.workshop` with `0o700`), and records `ok` with the path. On `409` it records `info` "already claimed on this device" plus the path if `KEY_FILE` exists. `403`, `429`, `503` record `fail` with the server's error word. `checkOpenRouter` reads `KEY_FILE` when `OPENROUTER_API_KEY` is unset, so `--check` reports the saved key.

- [ ] **Step 1: Write the failing tests**

Add to `test/setup.test.mjs` a fake dispenser (`createServer`) that answers `POST /claim` with `201 { key: 'sk-or-good', id: 7 }` for `code === 'tulip'` and a new device, `409` for a repeated device, `403` otherwise; it records bodies.

```js
test('--claim gets a key, saves it 0600 and prints it once', async () => {
  const { home, env } = makeEnv({ claude: 'logged-in' });
  const { code, out } = await runSetup(['--claim', dispenserUrl, '--code', 'tulip'], env);
  assert.equal(code, 0, out);
  const file = path.join(home, '.workshop', 'openrouter.env');
  assert.equal(readFileSync(file, 'utf8'), 'OPENROUTER_API_KEY=sk-or-good\n');
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(out.split('sk-or-good').length - 1, 1);
  assert.match(out, /Use one path, not both\./);
  assert.ok(!/Downloading|npm ci|prompt-pantry/.test(out));           // claim-only
  assert.equal(claimBodies[0].device.length, 64);
});
test('--claim with a wrong code fails without a prompt and without a TTY', ...);   // exit 1, /wrong_code/, no hang (test has a 10 s timeout)
test('--claim twice reports already claimed, exits 0 and shows the saved path', ...);
test('--check reads the saved key file when the env is unset', ...);  // write the file by hand, run --check with FAST: /valid, \$9\.50 left/
test('deviceId is stable and 64 hex chars', () => { assert.match(deviceId(), /^[0-9a-f]{64}$/); assert.equal(deviceId(), deviceId()); });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/setup.test.mjs`
Expected: FAIL, `Unknown option: --claim`

- [ ] **Step 3: Implement in `setup.mjs`**

Keep the existing "never printed" test for the paste path passing. Update the in-script notice at the top of the file and the `printSummary` "About models and keys" lines: a workshop key claimed with `--claim` is saved to `~/.workshop/openrouter.env` (mode 0600); delete it after the event. Update `HELP` with `--claim <url>` and `--code <word>` and the `WORKSHOP_CODE` env.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/setup.test.mjs test/keys.test.mjs`
Expected: PASS, all

- [ ] **Step 5: Update `README.md` "3. Models and keys"**

Replace "ask the speakers at the start of the session for a workshop key" with: at the session the speakers show a URL and say a code; either open the URL in a browser, or run `node setup.mjs --claim <url> --code <word>`. Use one path, not both. The key is capped at $10 and expires the same day. Then the copy about the saved file and `source ~/.workshop/openrouter.env`.

- [ ] **Step 6: Commit**

```bash
git add setup.mjs test/setup.test.mjs README.md
git commit -m "feat(setup): --claim fetches a workshop key from the dispenser"
```

### Task 7: Public `keys/README.md`

**Files:**
- Create: `keys/README.md`

- [ ] **Step 1: Write it**

Generic, no Brevo details. Sections: What this is (one paragraph). Mint (`OPENROUTER_MANAGEMENT_KEY=... node keys/mint-keys.mjs --count 60 --limit 10 --expires <ISO> --out pool.json`; create the management key with an expiry; `pool.json` is the only copy). Run the server (the env table from the spec, `POOL_LOAD=50`). Expose it (`cloudflared tunnel --no-autoupdate --url http://localhost:8080`, URL from its output). Move state (`curl -H 'Authorization: Bearer $STATS_TOKEN' <url>/state > state.json`, then `STATE_IMPORT=state.json`). Revoke. Tests (`node --test test/keys.test.mjs`). Residual risks, copied from the spec's security table in plain words.

- [ ] **Step 2: Check and commit**

Run: `grep -i -E 'brevo|devbox|vpn|kubectl' keys/README.md` → no output.

```bash
git add keys/README.md
git commit -m "docs(keys): how to mint, run, expose, and revoke"
```

### Task 8: Devbox manifests and run-sheet (brevo-agent)

**Files (in `/Users/sagarpuri/Documents/DTSL/brevo-code/brevo-agent`, new branch `feat/workshop-keys-devbox` off `main`):**
- Create: `tools/workshop-keys/k8s/namespace.yaml`, `tools/workshop-keys/k8s/deployment.yaml`, `tools/workshop-keys/k8s/service.yaml`, `tools/workshop-keys/deploy.sh`, `tools/workshop-keys/RUNSHEET.md`, `tools/workshop-keys/README.md`

**Interfaces:**
- Consumes `keys/server.mjs`, `keys/public/index.html` (mounted from a ConfigMap), the pool format, and the env contract from Task 4.
- Produces a running dispenser on devbox with a trycloudflare.com URL.

- [ ] **Step 1: Write the manifests**

`namespace.yaml`: `workshop-keys`. `deployment.yaml`: one replica, strategy `Recreate`, `securityContext` `runAsNonRoot: true, runAsUser: 1000, readOnlyRootFilesystem: true, capabilities.drop: [ALL]`; container `dispenser` image `node:24-alpine` pinned by digest (resolve with `docker manifest inspect` or `crane digest` and paste), command `["node", "/app/server.mjs"]`, env from Secret `dispenser-env` (`EVENT_CODE`, `DEVICE_SALT`, `STATS_TOKEN`) plus literals `POOL_FILE=/pool/pool.json`, `POOL_LOAD=50`, `STATE_FILE=/state/state.json`, `STATE_IMPORT=/import/state.json`, `PORT=8080`; mounts: ConfigMap `dispenser-code` at `/app` (keys `server.mjs`, `index.html` projected to `public/index.html`), Secret `pool` at `/pool` read-only, `emptyDir` at `/state`, optional Secret `state-import` at `/import` (`optional: true`); `readinessProbe` `GET /healthz`; resources requests `50m`/`64Mi`, limits `200m`/`128Mi`. Container `cloudflared` image `cloudflare/cloudflared:latest`, args `["tunnel", "--no-autoupdate", "--url", "http://localhost:8080"]`, same resources. `service.yaml`: ClusterIP on 8080, for `port-forward` only.

- [ ] **Step 2: Write `deploy.sh`**

Arguments: path to the workshop repo checkout and to `pool.json`. Steps, each echoed: `kubectl --context kubernetes-admin@devbox apply -f k8s/namespace.yaml`; create or replace ConfigMap `dispenser-code` from `$WORKSHOP/keys/server.mjs` and `$WORKSHOP/keys/public/index.html`; create or replace Secret `pool` from the pool file; create Secret `dispenser-env` from `EVENT_CODE` (argument), `DEVICE_SALT` and `STATS_TOKEN` (`openssl rand -hex 32` each, printed once for the speaker to save); if `state.json` is given, Secret `state-import`; apply deployment and service; wait for ready; print the tunnel URL with `kubectl logs deploy/dispenser -c cloudflared | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1`. `set -euo pipefail`. Secret create uses `--dry-run=client -o yaml | kubectl apply -f -` so re-runs work.

- [ ] **Step 3: Write `RUNSHEET.md` and `README.md`**

`RUNSHEET.md`: Week before: preflight (the two-container nginx+cloudflared pod, expect a 200 from a phone; delete the namespace). Day before: create the management key with expiry at the day after the event; mint 60; `deploy.sh`; test one claim from a phone on mobile data via the browser and one via `node setup.mjs --claim`; check `/stats` via `kubectl port-forward svc/dispenser 8080:8080` shows 2 claimed; put URL, QR, and code on the slide. Day of: re-check the URL in the logs (a restart changes it), watch `/stats`, hand spares (ids 51 to 60 in `pool.json`) by showing them on a laptop screen. Fallback: export `/state`, run the server and `cloudflared` on the laptop with `STATE_IMPORT`, change the slide. Day after: `kubectl delete ns workshop-keys`, `node keys/revoke-keys.mjs --pool pool.json` (optional, expiry covers it), delete `pool.json`, delete the management key in the OpenRouter dashboard. `README.md`: two paragraphs on what lives here and a pointer to the public repo's `keys/README.md`.

- [ ] **Step 4: Verify against the cluster**

Run with a 3-key fake pool (`{"keys":[{"id":1,"hash":"h","key":"k1"},...]}`), on the VPN:

```bash
tools/workshop-keys/deploy.sh <workshop checkout> /tmp/fake-pool.json tulip
```

Expected: a trycloudflare.com URL printed; `curl -s -X POST <url>/claim -H 'content-type: application/json' -d '{"code":"tulip","device":"t1"}'` → `201` with `k1`; the same again → `409`; `kubectl -n workshop-keys exec deploy/dispenser -c dispenser -- id` → uid 1000; then `kubectl delete ns workshop-keys`.

- [ ] **Step 5: Commit and open the PR**

```bash
git add tools/workshop-keys
git commit -m "feat(tools): workshop key dispenser on devbox"
```

Push the branch and raise a PR against `main` in `DTSL/brevo-agent` with the usual description format.

### Task 9: Workshop repo PR

- [ ] **Step 1: Full test run**

Run: `node --test test/setup.test.mjs test/keys.test.mjs`
Expected: PASS, all

- [ ] **Step 2: Fork, push, PR**

`gh repo fork sahilsharma2408/sc-ai-coding-workflows-files --clone=false`, push the branch (stacked on `feat/setup-script`) to the fork, open a PR against `sahilsharma2408:feat/setup-script` titled "feat: workshop key dispenser and setup --claim". The body summarises the three pieces, the device-binding limits, and the one change to the "never written to disk" promise.
