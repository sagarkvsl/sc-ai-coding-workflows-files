#!/usr/bin/env node
// Disable every key in a pool file. Speaker laptop only. Safe to run twice.
//
//   OPENROUTER_MANAGEMENT_KEY=... node keys/revoke-keys.mjs --pool pool.json
//
// Keys expire on their own at the time given when they were minted; this is for stopping early.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from './openrouter.mjs';

const HELP = `Usage: OPENROUTER_MANAGEMENT_KEY=... node keys/revoke-keys.mjs --pool <pool.json>\n`;

export async function revoke(client, pool) {
  let disabled = 0;
  let failed = 0;
  for (const { id, hash } of pool.keys) {
    try {
      await client.disableKey(hash);
      disabled += 1;
    } catch (err) {
      failed += 1;
      console.error(`key ${id}: ${err.message}`);
    }
  }
  return { disabled, failed };
}

async function main() {
  const argv = process.argv.slice(2);
  const at = argv.indexOf('--pool');
  const file = at >= 0 ? argv[at + 1] : null;
  if (!file || argv.includes('--help') || argv.includes('-h')) {
    console.error(HELP);
    return 2;
  }
  const managementKey = process.env.OPENROUTER_MANAGEMENT_KEY;
  if (!managementKey) {
    console.error('OPENROUTER_MANAGEMENT_KEY is not set.');
    return 2;
  }
  const pool = JSON.parse(readFileSync(path.resolve(file), 'utf8'));
  const { disabled, failed } = await revoke(createClient({ managementKey }), pool);
  console.log(`Revoke: disabled ${disabled}, failed ${failed} of ${pool.keys.length}`);
  return failed > 0 ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code), (err) => { console.error(err); process.exit(1); });
}
