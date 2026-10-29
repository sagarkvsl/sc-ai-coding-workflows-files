// Tests for keys/: mint, revoke and the dispenser. Run with: node --test test/keys.test.mjs
// A fake OpenRouter server stands in for the provisioning API, so no network and no real keys.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createClient } from '../keys/openrouter.mjs';
import { mint, parseMintArgs } from '../keys/mint-keys.mjs';

const MINT = fileURLToPath(new URL('../keys/mint-keys.mjs', import.meta.url));
const MGMT = 'mgmt-test-key';

// ---------- fake OpenRouter provisioning API ----------

let fake;
let baseUrl;
let requests;
let created;

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
      res.statusCode = 404;
      res.end('{}');
    });
  });
  await new Promise((resolve) => fake.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${fake.address().port}/api/v1`;
});

after(() => fake.close());

beforeEach(() => { requests = []; created = 0; });

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
