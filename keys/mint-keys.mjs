#!/usr/bin/env node
// Mint a pool of capped, expiring OpenRouter keys for a workshop. Speaker laptop only.
//
//   OPENROUTER_MANAGEMENT_KEY=... node keys/mint-keys.mjs --expires 2026-11-05T22:00:00Z [--count 60] [--limit 10] [--out pool.json]
//
// The management key comes from the environment and is never written anywhere.
// pool.json is the only copy of the minted keys. Keep it off git and delete it after the event.

import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from './openrouter.mjs';

const HELP = `Usage: OPENROUTER_MANAGEMENT_KEY=... node keys/mint-keys.mjs --expires <ISO 8601 UTC with seconds> [options]

Options:
  --expires <ts>   Required. When every key stops working, e.g. 2026-11-05T22:00:00Z
  --count <n>      How many keys to mint (default 60)
  --limit <usd>    Spending cap per key in USD (default 10)
  --prefix <name>  Key name prefix (default workshop)
  --out <file>     Where to write the pool (default pool.json). Refuses to overwrite.
`;

const ISO_WITH_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function parseMintArgs(argv) {
  const opts = { count: 60, limit: 10, prefix: 'workshop', out: 'pool.json', expires: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${arg} needs a value`);
      return v;
    };
    if (arg === '--expires') opts.expires = value();
    else if (arg === '--count') opts.count = Number(value());
    else if (arg === '--limit') opts.limit = Number(value());
    else if (arg === '--prefix') opts.prefix = value();
    else if (arg === '--out') opts.out = value();
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (opts.help) return opts;
  if (!opts.expires || !ISO_WITH_SECONDS.test(opts.expires) || Number.isNaN(Date.parse(opts.expires))) {
    throw new Error('--expires is required and must be ISO 8601 UTC with seconds, e.g. 2026-11-05T22:00:00Z');
  }
  if (!Number.isInteger(opts.count) || opts.count < 1) throw new Error('--count must be a positive integer');
  if (!(opts.limit > 0)) throw new Error('--limit must be a positive number');
  return opts;
}

export async function mint(client, { count, limit, expires, prefix }) {
  const keys = [];
  for (let id = 1; id <= count; id++) {
    const name = `${prefix}-${String(id).padStart(3, '0')}`;
    const { key, hash } = await client.createKey({ name, limit, expiresAt: expires });
    keys.push({ id, hash, key });
  }
  return { event: prefix, expires_at: expires, keys };
}

async function main() {
  let opts;
  try {
    opts = parseMintArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`${err.message}\n\n${HELP}`);
    return 2;
  }
  if (opts.help) { console.log(HELP); return 0; }
  const managementKey = process.env.OPENROUTER_MANAGEMENT_KEY;
  if (!managementKey) {
    console.error('OPENROUTER_MANAGEMENT_KEY is not set. Create a management key (with an expiry) in the OpenRouter dashboard.');
    return 2;
  }
  const out = path.resolve(opts.out);
  if (existsSync(out)) {
    console.error(`${out} already exists. Refusing to overwrite a pool: move it away first.`);
    return 1;
  }
  try {
    const pool = await mint(createClient({ managementKey }), opts);
    writeFileSync(out, JSON.stringify(pool, null, 2) + '\n', { mode: 0o600 });
    console.log(`Minted ${pool.keys.length} keys (limit $${opts.limit} each, expire ${opts.expires}) into ${out}`);
    console.log('This file is the only copy. Keep it off git and delete it after the event.');
    return 0;
  } catch (err) {
    console.error(`Mint failed: ${err.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code), (err) => { console.error(err); process.exit(1); });
}
