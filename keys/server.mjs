#!/usr/bin/env node
// Workshop key dispenser: hands out one pre-minted OpenRouter key per device.
//
// Single file, Node built-ins only, so it can be mounted into a stock node image as-is.
// It never sees the OpenRouter management key. It holds only the pool of disposable keys,
// which are capped and expire on their own. Keys are never logged.
//
// Env: POOL_FILE, POOL_LOAD (default 50), EVENT_CODE, DEVICE_SALT, STATS_TOKEN, STATE_FILE,
//      STATE_IMPORT (optional), PORT (default 8080).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

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

function readClaims(file) {
  if (!file || !existsSync(file)) return {};
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  return parsed?.claims && typeof parsed.claims === 'object' ? { ...parsed.claims } : {};
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
