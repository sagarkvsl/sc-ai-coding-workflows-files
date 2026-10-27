// Tests for setup.mjs. Run with: node --test test/setup.test.mjs
// Integration tests run the real script against a temp HOME, a stubbed `claude`
// and a fake OpenRouter server, so they need no network and no real keys.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { nodeSupported, parseArgs, parseVersion } from '../setup.mjs';

const SCRIPT = fileURLToPath(new URL('../setup.mjs', import.meta.url));
const posixOnly = { skip: process.platform === 'win32' ? 'stubs are shell scripts' : false };

describe('parseVersion and nodeSupported', () => {
  test('parses versions', () => {
    assert.deepEqual(parseVersion('v22.12.0'), [22, 12, 0]);
    assert.deepEqual(parseVersion('2.1.311 (Claude Code)'), [2, 1, 311]);
    assert.equal(parseVersion('nope'), null);
  });

  test('accepts the Node versions the workshop stack supports', () => {
    for (const v of ['v22.22.2', 'v22.23.4', 'v24.15.0', 'v24.22.1', 'v26.1.0']) {
      assert.ok(nodeSupported(parseVersion(v)), v);
    }
    for (const v of ['v18.20.0', 'v20.19.0', 'v21.7.0', 'v22.12.0', 'v23.0.0', 'v24.14.0', 'v25.1.0', 'v27.0.0']) {
      assert.ok(!nodeSupported(parseVersion(v)), v);
    }
  });
});

describe('parseArgs', () => {
  test('defaults to ~/prompt-pantry', () => {
    const opts = parseArgs([]);
    assert.equal(opts.project, path.join(os.homedir(), 'prompt-pantry'));
    assert.equal(opts.check, false);
  });

  test('reads every flag', () => {
    const opts = parseArgs(['--project', '~/x', '--check', '-y', '--skip-harness', '--skip-demo', '--no-color']);
    assert.equal(opts.project, path.join(os.homedir(), 'x'));
    assert.deepEqual([opts.check, opts.yes, opts.skipHarness, opts.skipDemo, opts.color], [true, true, true, true, false]);
    assert.equal(parseArgs(['--project=rel']).project, path.resolve('rel'));
  });

  test('rejects unknown flags and a missing --project value', () => {
    assert.throws(() => parseArgs(['--nope']), /Unknown option/);
    assert.throws(() => parseArgs(['--project']), /needs a directory/);
  });
});

// ---------- integration ----------

let fakeOpenRouter;
let apiBase;
const KEYS = {
  'sk-or-good': { limit_remaining: 9.5 },
  'sk-or-low': { limit_remaining: 0.4 },
  'sk-or-unlimited': { limit_remaining: null },
};

before(async () => {
  fakeOpenRouter = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    if (req.url === '/api/v1/models') {
      res.end(JSON.stringify({ data: [{ id: 'deepseek/deepseek-v4-pro' }, { id: 'deepseek/deepseek-v4-flash' }] }));
    } else if (req.url === '/api/v1/key') {
      const key = (req.headers.authorization ?? '').replace('Bearer ', '');
      if (KEYS[key]) res.end(JSON.stringify({ data: KEYS[key] }));
      else { res.statusCode = 401; res.end(JSON.stringify({ error: { message: 'No auth credentials found' } })); }
    } else { res.statusCode = 404; res.end('{}'); }
  });
  await new Promise((resolve) => fakeOpenRouter.listen(0, '127.0.0.1', resolve));
  apiBase = `http://127.0.0.1:${fakeOpenRouter.address().port}/api/v1`;
});

after(() => fakeOpenRouter.close());

// PATH without any real `claude`, plus an optional stub that reports a sign-in state.
function makeEnv({ claude, gitIdentity = true, extra = {} } = {}) {
  const home = mkdtempSync(path.join(os.tmpdir(), 'setup-home-'));
  const bin = path.join(home, 'stub-bin');
  mkdirSync(bin);
  const hostPath = (process.env.PATH ?? '').split(path.delimiter)
    .filter((dir) => dir && !existsSync(path.join(dir, 'claude')));
  if (claude) {
    const status = JSON.stringify({ loggedIn: claude === 'logged-in', authMethod: 'claude.ai' });
    writeFileSync(path.join(bin, 'claude'),
      `#!/bin/sh\ncase "$1" in\n  --version) echo "9.9.9 (Claude Code)";;\n  auth) echo '${status}';;\nesac\n`);
    chmodSync(path.join(bin, 'claude'), 0o755);
  }
  if (gitIdentity) {
    writeFileSync(path.join(home, '.gitconfig'), '[user]\n\tname = Test Person\n\temail = test@example.com\n');
  }
  const env = {
    PATH: [bin, ...hostPath].join(path.delimiter),
    HOME: home,
    USERPROFILE: home,
    GIT_CONFIG_NOSYSTEM: '1',
    NO_COLOR: '1',
    WORKSHOP_OPENROUTER_API: apiBase,
    npm_config_cache: process.env.npm_config_cache ?? path.join(os.homedir(), '.npm'),
    ...extra,
  };
  return { home, env };
}

// Async, so the fake OpenRouter server in this process can answer while the script runs.
function runSetup(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, '--no-color', ...args], { env, cwd: env.HOME });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => resolve({ code, out }));
  });
}

const FAST = ['--skip-harness', '--skip-demo'];

describe('setup.mjs end to end (no network)', posixOnly, () => {
  test('--yes creates the project with specs, .gitignore and one commit', async () => {
    const { home, env } = makeEnv({ claude: 'logged-in' });
    const project = path.join(home, 'prompt-pantry');
    const { code, out } = await runSetup(['--yes', ...FAST, '--project', project], env);
    assert.equal(code, 0, out);
    assert.deepEqual(readdirSync(path.join(project, 'specs')).sort(), ['mission.md', 'roadmap.md', 'tech-stack.md']);
    assert.match(readFileSync(path.join(project, '.gitignore'), 'utf8'), /\.env/);
    const log = spawnSync('git', ['log', '--format=%s', 'main'], { cwd: project, encoding: 'utf8', env });
    assert.equal(log.stdout.trim(), 'Add workshop specs');
    assert.match(out, /Claude Code — 9\.9\.9/);
    assert.match(out, /signed in \(claude\.ai\)/);
    assert.match(out, /cd .*prompt-pantry/);
  });

  test('defaults the project to ~/prompt-pantry', async () => {
    const { home, env } = makeEnv({ claude: 'logged-in' });
    const { code, out } = await runSetup(['--yes', ...FAST], env);
    assert.equal(code, 0, out);
    assert.ok(existsSync(path.join(home, 'prompt-pantry', 'specs', 'roadmap.md')));
  });

  test('running twice leaves an existing project alone', async () => {
    const { home, env } = makeEnv({ claude: 'logged-in' });
    const project = path.join(home, 'pp');
    await runSetup(['--yes', ...FAST, '--project', project], env);
    const { code, out } = await runSetup(['--yes', ...FAST, '--project', project], env);
    assert.equal(code, 0, out);
    assert.match(out, /already set up/);
    const count = spawnSync('git', ['rev-list', '--count', 'HEAD'], { cwd: project, encoding: 'utf8', env });
    assert.equal(count.stdout.trim(), '1');
  });

  test('never touches a non-empty folder', async () => {
    const { home, env } = makeEnv({ claude: 'logged-in' });
    const project = path.join(home, 'busy');
    mkdirSync(project);
    writeFileSync(path.join(project, 'mine.txt'), 'keep me');
    const { code, out } = await runSetup(['--yes', ...FAST, '--project', project], env);
    assert.equal(code, 0, out);
    assert.match(out, /exists and is not empty, left untouched/);
    assert.deepEqual(readdirSync(project), ['mine.txt']);
  });

  test('--check creates nothing', async () => {
    const { home, env } = makeEnv({ claude: 'logged-in' });
    const project = path.join(home, 'pp');
    const { code, out } = await runSetup(['--check', ...FAST, '--project', project], env);
    assert.equal(code, 0, out);
    assert.match(out, /not created yet/);
    assert.ok(!existsSync(project));
  });

  test('missing Claude Code is a warning that names other frontier agents', async () => {
    const { env } = makeEnv();
    const { code, out } = await runSetup(['--check', ...FAST], env);
    assert.equal(code, 0, out);
    assert.match(out, /! Claude Code — not installed/);
    assert.match(out, /claude\.ai\/install/);
    assert.match(out, /another agent with a frontier model/);
  });

  test('signed-out Claude Code is flagged; ANTHROPIC_API_KEY counts as signed in', async () => {
    const signedOut = makeEnv({ claude: 'logged-out' });
    assert.match((await runSetup(['--check', ...FAST], signedOut.env)).out, /! Claude Code sign-in — not signed in/);
    const apiKey = makeEnv({ claude: 'logged-out', extra: { ANTHROPIC_API_KEY: 'sk-ant-test' } });
    assert.match((await runSetup(['--check', ...FAST], apiKey.env)).out, /using ANTHROPIC_API_KEY/);
  });

  test('no OpenRouter key: tells you we provide one', async () => {
    const { env } = makeEnv({ claude: 'logged-in' });
    const { out } = await runSetup(['--check', ...FAST], env);
    assert.match(out, /DeepSeek models on OpenRouter — deepseek\/deepseek-v4-pro, deepseek\/deepseek-v4-flash/);
    assert.match(out, /OpenRouter key — not provided/);
    assert.match(out, /we provide a workshop key/);
  });

  test('checks an OpenRouter key from the environment and never prints it', async () => {
    const cases = [
      ['sk-or-good', /✔ OpenRouter key — valid, \$9\.50 left on this key/],
      ['sk-or-unlimited', /✔ OpenRouter key — valid, no spending limit set/],
      ['sk-or-low', /! OpenRouter key — valid, \$0\.40 left on this key[\s\S]*Add credit/],
      ['sk-or-wrong', /! OpenRouter key — rejected \(HTTP 401\)/],
    ];
    for (const [key, expected] of cases) {
      const { home, env } = makeEnv({ claude: 'logged-in', extra: { OPENROUTER_API_KEY: key } });
      const project = path.join(home, 'pp');
      const { code, out } = await runSetup(['--yes', ...FAST, '--project', project], env);
      assert.equal(code, 0, out);
      assert.match(out, expected);
      assert.ok(!out.includes(key), `key ${key} leaked into output`);
      const grep = spawnSync('grep', ['-r', key, home], { encoding: 'utf8' });
      assert.equal(grep.stdout, '', `key ${key} written to disk`);
    }
  });

  test('unreachable OpenRouter is a warning, not a failure', async () => {
    const { env } = makeEnv({ claude: 'logged-in', extra: { WORKSHOP_OPENROUTER_API: 'http://127.0.0.1:1/api/v1' } });
    const { code, out } = await runSetup(['--check', ...FAST], env);
    assert.equal(code, 0, out);
    assert.match(out, /! OpenRouter reachable — could not reach openrouter\.ai/);
  });

  test('missing Git identity: project is created, commit failure is explained', async () => {
    const { home, env } = makeEnv({ claude: 'logged-in', gitIdentity: false,
      extra: { GIT_AUTHOR_NAME: '', GIT_COMMITTER_NAME: '', EMAIL: '', GIT_CONFIG_GLOBAL: path.join(os.tmpdir(), 'none.gitconfig') } });
    const project = path.join(home, 'pp');
    const { out } = await runSetup(['--yes', ...FAST, '--project', project], env);
    assert.match(out, /! Git identity — user\.name or user\.email not set/);
    assert.ok(existsSync(path.join(project, 'specs', 'mission.md')));
  });

  test('a harness already listening on 3080 is reported, not restarted', async (t) => {
    const server = createTcpServer((socket) => socket.end());
    const listening = await new Promise((resolve) => {
      server.once('error', () => resolve(false));
      server.listen(3080, '127.0.0.1', () => resolve(true));
    });
    if (!listening) return t.skip('port 3080 is busy on this machine');
    try {
      const { env } = makeEnv({ claude: 'logged-in' });
      const { code, out } = await runSetup(['--check', '--skip-demo'], env);
      assert.equal(code, 0, out);
      assert.match(out, /already running on 127\.0\.0\.1:3080/);
    } finally {
      server.close();
    }
  });
});
