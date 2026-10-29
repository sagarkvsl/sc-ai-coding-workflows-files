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
import { createBucket, createClaims, createLockout, hashDevice, loadPool } from '../keys/server.mjs';

const MINT = fileURLToPath(new URL('../keys/mint-keys.mjs', import.meta.url));
const REVOKE = fileURLToPath(new URL('../keys/revoke-keys.mjs', import.meta.url));
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
