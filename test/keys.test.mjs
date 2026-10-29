// Tests for keys/: mint, revoke and the dispenser. Run with: node --test test/keys.test.mjs
// A fake OpenRouter server stands in for the provisioning API, so no network and no real keys.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createClient } from '../keys/openrouter.mjs';
import { mint, parseMintArgs } from '../keys/mint-keys.mjs';
import { revoke } from '../keys/revoke-keys.mjs';
import { createBucket, createClaims, createDispenser, createLockout, hashDevice, loadPool } from '../keys/server.mjs';

const MINT = fileURLToPath(new URL('../keys/mint-keys.mjs', import.meta.url));
const REVOKE = fileURLToPath(new URL('../keys/revoke-keys.mjs', import.meta.url));
const SERVER = fileURLToPath(new URL('../keys/server.mjs', import.meta.url));
const PUBLIC = fileURLToPath(new URL('../keys/public', import.meta.url));
const MGMT = 'mgmt-test-key';

// ---------- fake OpenRouter provisioning API ----------

let fake;
let baseUrl;
let requests;
let created;
let failPatchOnce;

before(async () => {
  fake = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, body });
      res.setHeader('content-type', 'application/json');
      if (req.headers.authorization !== `Bearer ${MGMT}`) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: { message: 'bad management key' } }));
      }
      if (req.method === 'POST' && req.url === '/api/v1/keys') {
        created += 1;
        res.statusCode = 201;
        return res.end(JSON.stringify({ key: `sk-or-fake-${created}`, data: { hash: `hash-${created}` } }));
      }
      const patch = /^\/api\/v1\/keys\/([^/]+)$/.exec(req.url);
      if (req.method === 'PATCH' && patch) {
        if (failPatchOnce === patch[1]) { failPatchOnce = null; res.statusCode = 500; return res.end('{}'); }
        return res.end(JSON.stringify({ data: { hash: patch[1], disabled: JSON.parse(body).disabled } }));
      }
      res.statusCode = 404;
      res.end('{}');
    });
  });
  await new Promise((resolve) => fake.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${fake.address().port}/api/v1`;
});

after(() => fake.close());

beforeEach(() => { requests = []; created = 0; failPatchOnce = null; });

function runNode(script, args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { env: { ...process.env, ...env } });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('exit', (code) => resolve({ code, out, err }));
  });
}

const tmp = () => mkdtempSync(path.join(os.tmpdir(), 'keys-test-'));

// ---------- mint ----------

describe('mint-keys', () => {
  test('mint creates count keys with limit and expiry', async () => {
    const client = createClient({ baseUrl, managementKey: MGMT });
    const pool = await mint(client, { count: 3, limit: 10, expires: '2026-11-05T22:00:00Z', prefix: 'workshop' });
    assert.equal(pool.keys.length, 3);
    assert.deepEqual(pool.keys.map((k) => k.id), [1, 2, 3]);
    assert.equal(pool.keys[0].key, 'sk-or-fake-1');
    assert.equal(pool.keys[0].hash, 'hash-1');
    assert.equal(pool.expires_at, '2026-11-05T22:00:00Z');
    assert.deepEqual(JSON.parse(requests[0].body), { name: 'workshop-001', limit: 10, expires_at: '2026-11-05T22:00:00Z' });
    assert.equal(requests[0].auth, `Bearer ${MGMT}`);
  });

  test('parseMintArgs has the spec defaults and requires a valid --expires', () => {
    const opts = parseMintArgs(['--expires', '2026-11-05T22:00:00Z']);
    assert.deepEqual(opts, { count: 60, limit: 10, prefix: 'workshop', out: 'pool.json', expires: '2026-11-05T22:00:00Z' });
    assert.equal(parseMintArgs(['--expires', '2026-11-05T22:00:00Z', '--count', '5', '--limit', '2']).count, 5);
    assert.throws(() => parseMintArgs([]), /--expires/);
    assert.throws(() => parseMintArgs(['--expires', '2026-11-05']), /--expires/);
    assert.throws(() => parseMintArgs(['--expires', '2026-11-05T22:00Z']), /--expires/);
  });

  test('mint CLI writes pool.json with mode 0600 and never prints a key', async () => {
    const out = path.join(tmp(), 'pool.json');
    const r = await runNode(MINT, ['--count', '2', '--expires', '2026-11-05T22:00:00Z', '--out', out],
      { OPENROUTER_MANAGEMENT_KEY: MGMT, WORKSHOP_OPENROUTER_API: baseUrl });
    assert.equal(r.code, 0, r.err);
    const pool = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(pool.keys.length, 2);
    assert.ok(!(r.out + r.err).includes('sk-or-fake'));
    if (process.platform !== 'win32') {
      const { statSync } = await import('node:fs');
      assert.equal(statSync(out).mode & 0o777, 0o600);
    }
  });

  test('mint CLI refuses to overwrite an existing --out file', async () => {
    const out = path.join(tmp(), 'pool.json');
    writeFileSync(out, '{}');
    const r = await runNode(MINT, ['--count', '2', '--expires', '2026-11-05T22:00:00Z', '--out', out],
      { OPENROUTER_MANAGEMENT_KEY: MGMT, WORKSHOP_OPENROUTER_API: baseUrl });
    assert.equal(r.code, 1);
    assert.match(r.err, /already exists/);
    assert.equal(requests.length, 0);
    assert.equal(readFileSync(out, 'utf8'), '{}');
  });

  test('mint CLI exits 2 without OPENROUTER_MANAGEMENT_KEY', async () => {
    const r = await runNode(MINT, ['--expires', '2026-11-05T22:00:00Z', '--out', path.join(tmp(), 'p.json')],
      { OPENROUTER_MANAGEMENT_KEY: '', WORKSHOP_OPENROUTER_API: baseUrl });
    assert.equal(r.code, 2);
    assert.match(r.err, /OPENROUTER_MANAGEMENT_KEY/);
  });

  test('mint fails fast on 401 and writes nothing', async () => {
    const out = path.join(tmp(), 'pool.json');
    const r = await runNode(MINT, ['--count', '2', '--expires', '2026-11-05T22:00:00Z', '--out', out],
      { OPENROUTER_MANAGEMENT_KEY: 'wrong', WORKSHOP_OPENROUTER_API: baseUrl });
    assert.equal(r.code, 1);
    assert.match(r.err, /401/);
    assert.ok(!existsSync(out));
  });
});

// ---------- revoke ----------

describe('revoke-keys', () => {
  const pool = { keys: [{ id: 1, hash: 'hash-1' }, { id: 2, hash: 'hash-2' }, { id: 3, hash: 'hash-3' }] };

  test('revoke disables every hash in the pool and reports counts', async () => {
    failPatchOnce = 'hash-2';
    const client = createClient({ baseUrl, managementKey: MGMT });
    const result = await revoke(client, pool);
    assert.deepEqual(result, { disabled: 2, failed: 1 });
    const patches = requests.filter((r) => r.method === 'PATCH');
    assert.deepEqual(patches.map((r) => r.url), ['/api/v1/keys/hash-1', '/api/v1/keys/hash-2', '/api/v1/keys/hash-3']);
    assert.ok(patches.every((r) => JSON.parse(r.body).disabled === true));
  });

  test('revoke is safe to run twice', async () => {
    const client = createClient({ baseUrl, managementKey: MGMT });
    await revoke(client, pool);
    assert.deepEqual(await revoke(client, pool), { disabled: 3, failed: 0 });
  });

  test('revoke CLI reads --pool, prints counts, exits 1 when any fail', async () => {
    const file = path.join(tmp(), 'pool.json');
    writeFileSync(file, JSON.stringify(pool));
    failPatchOnce = 'hash-3';
    const r = await runNode(REVOKE, ['--pool', file], { OPENROUTER_MANAGEMENT_KEY: MGMT, WORKSHOP_OPENROUTER_API: baseUrl });
    assert.equal(r.code, 1, r.err);
    assert.match(r.out, /disabled 2/);
    assert.match(r.out, /failed 1/);
    const ok = await runNode(REVOKE, ['--pool', file], { OPENROUTER_MANAGEMENT_KEY: MGMT, WORKSHOP_OPENROUTER_API: baseUrl });
    assert.equal(ok.code, 0, ok.err);
  });
});

// ---------- dispenser core ----------

describe('dispenser core', () => {
  test('loadPool takes the first N by id and rejects bad pools', () => {
    const json = JSON.stringify({ keys: [{ id: 2, key: 'b' }, { id: 1, key: 'a' }, { id: 3, key: 'c' }] });
    assert.deepEqual(loadPool(json, 2), [{ id: 1, key: 'a' }, { id: 2, key: 'b' }]);
    assert.equal(loadPool(json, 10).length, 3);
    assert.throws(() => loadPool(JSON.stringify({ keys: [{ id: 1, key: 'a' }, { id: 1, key: 'b' }] }), 2), /duplicate id 1/);
    assert.throws(() => loadPool(JSON.stringify({ keys: [{ id: 1 }] }), 1), /key 1 has no key/);
    assert.throws(() => loadPool('not json', 1), /pool/);
    assert.throws(() => loadPool(JSON.stringify({}), 1), /pool/);
  });

  test('hashDevice is salted sha256', () => {
    assert.equal(hashDevice('s', 'd'), createHash('sha256').update('s:d').digest('hex'));
    assert.notEqual(hashDevice('s', 'd'), hashDevice('t', 'd'));
  });

  test('claims issue once per device, then already_claimed, then pool_empty', () => {
    const stateFile = path.join(tmp(), 'state.json');
    const claims = createClaims({ stateFile, log: () => {} });
    const pool = [{ id: 1, key: 'k1' }, { id: 2, key: 'k2' }];
    assert.deepEqual(claims.claim('A', pool), { status: 'issued', id: 1, key: 'k1' });
    assert.deepEqual(claims.claim('A', pool), { status: 'already_claimed' });
    assert.equal(claims.claim('B', pool).id, 2);
    assert.deepEqual(claims.claim('C', pool), { status: 'pool_empty' });
    assert.deepEqual(claims.stats(pool), { total: 2, claimed: 2, remaining: 0 });
    assert.deepEqual(claims.export(), { claims: { A: 1, B: 2 } });
    assert.deepEqual(JSON.parse(readFileSync(stateFile, 'utf8')), { claims: { A: 1, B: 2 } });
    assert.ok(!readFileSync(stateFile, 'utf8').includes('k1'));
  });

  test('claims reload from stateFile and from importFile', () => {
    const dir = tmp();
    const stateFile = path.join(dir, 'state.json');
    const pool = [{ id: 1, key: 'k1' }, { id: 2, key: 'k2' }, { id: 3, key: 'k3' }];
    createClaims({ stateFile, log: () => {} }).claim('A', pool);
    const again = createClaims({ stateFile, log: () => {} });
    assert.deepEqual(again.claim('A', pool), { status: 'already_claimed' });
    assert.equal(again.claim('B', pool).id, 2);

    const importFile = path.join(dir, 'import.json');
    writeFileSync(importFile, JSON.stringify({ claims: { X: 1, Y: 3 } }));
    const imported = createClaims({ stateFile: path.join(dir, 'fresh.json'), importFile, log: () => {} });
    assert.deepEqual(imported.stats(pool), { total: 3, claimed: 2, remaining: 1 });
    assert.equal(imported.claim('Z', pool).id, 2);
    assert.deepEqual(imported.claim('X', pool), { status: 'already_claimed' });
  });

  test('an unwritable stateFile logs once and still issues', () => {
    const logs = [];
    const claims = createClaims({ stateFile: '/nonexistent/dir/state.json', log: (m) => logs.push(m) });
    const pool = [{ id: 1, key: 'k1' }, { id: 2, key: 'k2' }];
    assert.equal(claims.claim('A', pool).status, 'issued');
    assert.equal(claims.claim('B', pool).status, 'issued');
    assert.equal(logs.filter((m) => /state/.test(m)).length, 1);
  });

  test('bucket allows capacity then refuses, and refills over time', () => {
    let now = 0;
    const bucket = createBucket({ capacity: 2, perMinute: 60, now: () => now });
    assert.equal(bucket.take('x'), true);
    assert.equal(bucket.take('x'), true);
    assert.equal(bucket.take('x'), false);
    assert.equal(bucket.take('y'), true);
    now = 1000;
    assert.equal(bucket.take('x'), true);
  });

  test('lockout trips after maxFailures and clears after the window', () => {
    let now = 0;
    const lockout = createLockout({ maxFailures: 10, minutes: 5, now: () => now });
    for (let i = 0; i < 9; i++) lockout.fail('d');
    assert.equal(lockout.locked('d'), false);
    lockout.fail('d');
    assert.equal(lockout.locked('d'), true);
    assert.equal(lockout.locked('e'), false);
    now = 5 * 60 * 1000 + 1;
    assert.equal(lockout.locked('d'), false);
  });
});

// ---------- dispenser HTTP ----------

const POOL3 = [{ id: 1, key: 'k1-secret' }, { id: 2, key: 'k2-secret' }, { id: 3, key: 'k3-secret' }];

async function startDispenser(overrides = {}) {
  const logs = [];
  const dir = tmp();
  const server = createDispenser({
    pool: POOL3,
    eventCode: 'tulip',
    deviceSalt: 'salt',
    statsToken: 'tok',
    claims: createClaims({ stateFile: path.join(dir, 'state.json'), log: (m) => logs.push(m) }),
    publicDir: PUBLIC,
    log: (m) => logs.push(m),
    ...overrides,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, logs, close: () => server.close() };
}

async function post(url, body, headers = {}) {
  const res = await fetch(`${url}/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function get(url, headers = {}) {
  const res = await fetch(url, { headers });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe('dispenser HTTP', () => {
  test('claim flow: 201 once per device, 409 on repeat, 403 wrong code, 503 when empty', async () => {
    const { url, close } = await startDispenser();
    try {
      const first = await post(url, { code: 'tulip', device: 'A' });
      assert.equal(first.status, 201);
      assert.deepEqual(first.body, { key: 'k1-secret', id: 1 });
      assert.equal((await post(url, { code: 'tulip', device: 'A' })).status, 409);
      assert.deepEqual((await post(url, { code: 'tulip', device: 'A' })).body, { error: 'already_claimed' });
      assert.equal((await post(url, { code: 'wrong', device: 'B' })).status, 403);
      assert.equal((await post(url, { code: 'tulip', device: 'B' })).status, 201);
      assert.equal((await post(url, { code: 'tulip', device: 'C' })).status, 201);
      const empty = await post(url, { code: 'tulip', device: 'D' });
      assert.equal(empty.status, 503);
      assert.deepEqual(empty.body, { error: 'pool_empty' });
    } finally { close(); }
  });

  test('bad bodies return 400 and the server keeps serving', async () => {
    const { url, close } = await startDispenser();
    try {
      assert.equal((await post(url, 'not json')).status, 400);
      assert.equal((await post(url, {})).status, 400);
      assert.equal((await post(url, { code: 'tulip', device: 'x'.repeat(129) })).status, 400);
      assert.equal((await post(url, { code: 'tulip', device: 'A', pad: 'y'.repeat(2000) })).status, 400);
      assert.equal((await post(url, { code: 5, device: 'A' })).status, 400);
      const health = await fetch(`${url}/healthz`);
      assert.equal(health.status, 200);
      assert.equal(await health.text(), 'ok');
    } finally { close(); }
  });

  test('client IP comes from cf-connecting-ip, so two tunnel clients get separate buckets', async () => {
    const { url, close } = await startDispenser({ ipBucket: createBucket({ capacity: 1, perMinute: 1 }) });
    try {
      assert.equal((await post(url, { code: 'tulip', device: 'A' }, { 'cf-connecting-ip': '1.1.1.1' })).status, 201);
      assert.equal((await post(url, { code: 'tulip', device: 'B' }, { 'cf-connecting-ip': '2.2.2.2' })).status, 201);
      const throttled = await post(url, { code: 'tulip', device: 'C' }, { 'cf-connecting-ip': '1.1.1.1' });
      assert.equal(throttled.status, 429);
      assert.deepEqual(throttled.body, { error: 'throttled' });
    } finally { close(); }
  });

  test('global bucket throttles every route', async () => {
    const { url, close } = await startDispenser({ globalBucket: createBucket({ capacity: 2, perMinute: 1 }) });
    try {
      assert.equal((await fetch(`${url}/healthz`)).status, 200);
      assert.equal((await fetch(`${url}/healthz`)).status, 200);
      assert.equal((await fetch(`${url}/healthz`)).status, 429);
    } finally { close(); }
  });

  test('ten wrong codes lock that device only', async () => {
    const { url, close } = await startDispenser();
    try {
      for (let i = 0; i < 10; i++) assert.equal((await post(url, { code: 'nope', device: 'X' })).status, 403);
      assert.equal((await post(url, { code: 'tulip', device: 'X' })).status, 429);
      assert.equal((await post(url, { code: 'tulip', device: 'Y' })).status, 201);
    } finally { close(); }
  });

  test('/stats and /state need the token and never contain keys', async () => {
    const { url, close } = await startDispenser();
    try {
      await post(url, { code: 'tulip', device: 'A' });
      assert.equal((await get(`${url}/stats`)).status, 401);
      assert.equal((await get(`${url}/stats`, { authorization: 'Bearer nope' })).status, 401);
      const stats = await get(`${url}/stats`, { authorization: 'Bearer tok' });
      assert.equal(stats.status, 200);
      assert.deepEqual(stats.body, { total: 3, claimed: 1, remaining: 2 });
      const state = await get(`${url}/state`, { authorization: 'Bearer tok' });
      assert.equal(state.status, 200);
      assert.deepEqual(Object.values(state.body.claims), [1]);
      assert.ok(!JSON.stringify(state.body).includes('secret'));
      assert.equal((await get(`${url}/nope`)).status, 404);
    } finally { close(); }
  });

  test('logs never contain a key, and carry the outcome', async () => {
    const { url, logs, close } = await startDispenser();
    try {
      await post(url, { code: 'tulip', device: 'A' });
      await post(url, { code: 'tulip', device: 'A' });
      const text = logs.join('\n');
      assert.ok(!text.includes('secret'));
      assert.ok(!text.includes('tulip'));
      assert.match(text, /POST \/claim 201/);
      assert.match(text, /POST \/claim 409/);
      assert.match(text, /id=1/);
    } finally { close(); }
  });

  test('main exits 2 naming a missing env var', async () => {
    const dir = tmp();
    const poolFile = path.join(dir, 'pool.json');
    writeFileSync(poolFile, JSON.stringify({ keys: POOL3 }));
    const r = await runNode(SERVER, [], { POOL_FILE: poolFile, DEVICE_SALT: 's', STATS_TOKEN: 't', STATE_FILE: path.join(dir, 's.json'), EVENT_CODE: '' });
    assert.equal(r.code, 2);
    assert.match(r.err, /EVENT_CODE/);
  });

  test('main serves on PORT with POOL_LOAD keys', async () => {
    const dir = tmp();
    const poolFile = path.join(dir, 'pool.json');
    writeFileSync(poolFile, JSON.stringify({ keys: POOL3 }));
    const child = spawn(process.execPath, [SERVER], {
      env: { ...process.env, POOL_FILE: poolFile, POOL_LOAD: '2', EVENT_CODE: 'tulip', DEVICE_SALT: 's', STATS_TOKEN: 't', STATE_FILE: path.join(dir, 's.json'), PORT: '0' },
    });
    let out = '';
    const port = await new Promise((resolve, reject) => {
      child.stdout.on('data', (d) => { out += d; const m = /listening on port (\d+)/.exec(out); if (m) resolve(Number(m[1])); });
      child.stderr.on('data', (d) => { out += d; });
      child.on('exit', (code) => reject(new Error(`exited ${code}: ${out}`)));
    });
    try {
      const stats = await get(`http://127.0.0.1:${port}/stats`, { authorization: 'Bearer t' });
      assert.deepEqual(stats.body, { total: 2, claimed: 0, remaining: 2 });
    } finally { child.kill(); }
  });
});
