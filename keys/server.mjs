#!/usr/bin/env node
// Workshop key dispenser: hands out one pre-minted OpenRouter key per device.
//
// Single file, Node built-ins only, so it can be mounted into a stock node image as-is.
// It never sees the OpenRouter management key. It holds only the pool of disposable keys,
// which are capped and expire on their own. Keys are never logged.
//
// Env: POOL_FILE, POOL_LOAD (default 50), EVENT_CODE, DEVICE_SALT, STATS_TOKEN, STATE_FILE,
//      STATE_IMPORT (optional), PORT (default 8080).

import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- pool ----------

export function loadPool(json, load) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('pool: file is not valid JSON');
  }
  if (!parsed || !Array.isArray(parsed.keys)) throw new Error('pool: expected { keys: [...] }');
  const seen = new Set();
  const keys = parsed.keys.map((k) => {
    if (!Number.isInteger(k?.id)) throw new Error('pool: every key needs an integer id');
    if (seen.has(k.id)) throw new Error(`pool: duplicate id ${k.id}`);
    seen.add(k.id);
    if (typeof k.key !== 'string' || !k.key) throw new Error(`pool: key ${k.id} has no key`);
    return { id: k.id, key: k.key };
  });
  keys.sort((a, b) => a.id - b.id);
  return keys.slice(0, load);
}

// ---------- device hashing ----------

export function hashDevice(salt, device) {
  return createHash('sha256').update(`${salt}:${device}`).digest('hex');
}

// ---------- claim state ----------

// Strict on purpose: a bad state file (for example a saved 401 body) must stop the server,
// not start it with zero claims and hand out keys that are already in someone's hands.
function readClaims(file) {
  if (!file || !existsSync(file)) return {};
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`state: ${file} is not valid JSON`);
  }
  const claims = parsed?.claims;
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) throw new Error(`state: ${file} has no "claims" object`);
  for (const [hash, id] of Object.entries(claims)) {
    if (typeof hash !== 'string' || !Number.isInteger(id)) throw new Error(`state: ${file} has a bad claim entry (${hash})`);
  }
  return { ...claims };
}

export function createClaims({ stateFile, importFile, log = console.error }) {
  const claims = { ...readClaims(importFile), ...readClaims(stateFile) };
  let warned = false;

  function persist() {
    if (!stateFile) return;
    try {
      mkdirSync(path.dirname(stateFile), { recursive: true });
      const tmp = `${stateFile}.tmp`;
      writeFileSync(tmp, JSON.stringify({ claims }) + '\n');
      renameSync(tmp, stateFile);
    } catch (err) {
      if (!warned) {
        warned = true;
        log(`state: cannot write ${stateFile} (${err.message}); claims are in memory only`);
      }
    }
  }

  return {
    claim(deviceHash, pool) {
      if (deviceHash in claims) return { status: 'already_claimed' };
      const taken = new Set(Object.values(claims));
      const next = pool.find((k) => !taken.has(k.id));
      if (!next) return { status: 'pool_empty' };
      claims[deviceHash] = next.id;
      persist();
      return { status: 'issued', id: next.id, key: next.key };
    },
    stats(pool) {
      const ids = new Set(pool.map((k) => k.id));
      const claimed = Object.values(claims).filter((id) => ids.has(id)).length;
      return { total: pool.length, claimed, remaining: pool.length - claimed };
    },
    export() {
      return { claims: { ...claims } };
    },
  };
}

// ---------- throttling ----------

export function createBucket({ capacity, perMinute, now = Date.now }) {
  const buckets = new Map();
  const perMs = perMinute / 60_000;
  return {
    take(key) {
      const t = now();
      const b = buckets.get(key) ?? { tokens: capacity, at: t };
      b.tokens = Math.min(capacity, b.tokens + (t - b.at) * perMs);
      b.at = t;
      if (b.tokens < 1) {
        buckets.set(key, b);
        return false;
      }
      b.tokens -= 1;
      buckets.set(key, b);
      return true;
    },
  };
}

export function createLockout({ maxFailures, minutes, now = Date.now }) {
  const failures = new Map();
  const windowMs = minutes * 60_000;
  return {
    fail(key) {
      const t = now();
      const entry = failures.get(key) ?? { count: 0, since: t };
      if (t - entry.since > windowMs) { entry.count = 0; entry.since = t; }
      entry.count += 1;
      failures.set(key, entry);
    },
    locked(key) {
      const entry = failures.get(key);
      if (!entry) return false;
      if (now() - entry.since > windowMs) { failures.delete(key); return false; }
      return entry.count >= maxFailures;
    },
  };
}

// ---------- HTTP ----------

const MAX_BODY = 1024;
const MAX_DEVICE = 128;

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function readBody(req) {
  return new Promise((resolve) => {
    let size = 0;
    let tooBig = false;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) { tooBig = true; chunks.length = 0; return; } // keep draining so the 400 can be sent
      chunks.push(chunk);
    });
    req.on('end', () => resolve(tooBig ? null : Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(null));
  });
}

export function createDispenser(config) {
  const {
    pool, eventCode, deviceSalt, statsToken, claims, publicDir, log = console.log,
    ipBucket = createBucket({ capacity: 120, perMinute: 120 }),
    globalBucket = createBucket({ capacity: 600, perMinute: 600 }),
    lockout = createLockout({ maxFailures: 10, minutes: 5 }),
  } = config;
  const page = () => readFileSync(path.join(publicDir, 'index.html'));

  function json(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
    return status;
  }

  function authorized(req) {
    const header = req.headers.authorization ?? '';
    return header.startsWith('Bearer ') && safeEqual(header.slice(7), statsToken);
  }

  async function handleClaim(req, res, ip) {
    const raw = await readBody(req);
    let body;
    try { body = raw === null ? null : JSON.parse(raw); } catch { body = null; }
    if (!body || typeof body !== 'object') return { status: json(res, 400, { error: 'bad_request' }) };
    const { code, device } = body;
    if (typeof code !== 'string' || typeof device !== 'string' || !device || device.length > MAX_DEVICE) {
      return { status: json(res, 400, { error: 'bad_request' }) };
    }
    const deviceHash = hashDevice(deviceSalt, device);
    const tag = `device=${deviceHash.slice(0, 8)}`;
    if (!ipBucket.take(ip)) return { status: json(res, 429, { error: 'throttled' }), tag };
    if (lockout.locked(deviceHash)) return { status: json(res, 429, { error: 'throttled' }), tag };
    if (!safeEqual(code, eventCode)) {
      lockout.fail(deviceHash);
      return { status: json(res, 403, { error: 'wrong_code' }), tag };
    }
    const result = claims.claim(deviceHash, pool);
    if (result.status === 'issued') return { status: json(res, 201, { key: result.key, id: result.id }), tag: `${tag} id=${result.id}` };
    if (result.status === 'already_claimed') return { status: json(res, 409, { error: 'already_claimed' }), tag };
    return { status: json(res, 503, { error: 'pool_empty' }), tag };
  }

  return createServer(async (req, res) => {
    const ip = req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress ?? 'unknown';
    const url = (req.url ?? '/').split('?')[0];
    let status;
    let tag = '';
    try {
      if (req.method === 'GET' && url === '/healthz') {
        // Before any bucket: a flood must never make the kubelet think the pod is dead.
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('ok');
        status = 200;
      } else if (!globalBucket.take('*')) {
        status = json(res, 429, { error: 'throttled' });
      } else if (req.method === 'GET' && url === '/') {
        const html = page();
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        res.end(html);
        status = 200;
      } else if (req.method === 'POST' && url === '/claim') {
        ({ status, tag = '' } = await handleClaim(req, res, ip));
      } else if (req.method === 'GET' && (url === '/stats' || url === '/state')) {
        if (!authorized(req)) status = json(res, 401, { error: 'unauthorized' });
        else status = json(res, 200, url === '/stats' ? claims.stats(pool) : claims.export());
      } else {
        status = json(res, 404, { error: 'not_found' });
      }
    } catch (err) {
      if (res.headersSent) { status = res.statusCode; res.end(); } else status = json(res, 500, { error: 'internal' });
      log(`error: ${err.message}`);
    }
    if (url !== '/healthz') log(`${req.method} ${url} ${status} ip=${ip} ${tag}`.trim());
  });
}

// ---------- main ----------

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set`);
    process.exit(2);
  }
  return value;
}

function main() {
  const poolFile = requireEnv('POOL_FILE');
  const eventCode = requireEnv('EVENT_CODE');
  const deviceSalt = requireEnv('DEVICE_SALT');
  const statsToken = requireEnv('STATS_TOKEN');
  const stateFile = requireEnv('STATE_FILE');
  const load = Number(process.env.POOL_LOAD ?? 50);
  const port = Number(process.env.PORT ?? 8080);
  const pool = loadPool(readFileSync(poolFile, 'utf8'), load);
  const claims = createClaims({ stateFile, importFile: process.env.STATE_IMPORT || undefined });
  const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
  const server = createDispenser({ pool, eventCode, deviceSalt, statsToken, claims, publicDir });
  server.listen(port, () => {
    const stats = claims.stats(pool);
    console.log(`dispenser listening on port ${server.address().port}: ${stats.total} keys loaded, ${stats.claimed} already claimed`);
  });
}

// realpathSync: a Kubernetes ConfigMap mounts files through symlinks, and Node resolves the
// main module's real path, so a plain path comparison would silently skip main() there.
function isMain() {
  try {
    return Boolean(process.argv[1]) && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMain()) main();
