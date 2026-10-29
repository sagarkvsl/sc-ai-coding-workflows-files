# Inference at the Edge of Your IDE

Companion files for the workshop *Inference at the Edge of Your IDE: Agentic React Development from Cloud LLMs to On-Device Models*.

Across the workshop you build the same small React app, Prompt Pantry, in four different AI coding setups: Claude Code in the cloud, the DeepSeek harness with OpenRouter models, a hybrid with a local subagent, and fully local. Keeping the app the same lets you compare what each setup gives you and what it asks of you.

This workshop builds on the DeepLearning.AI course *AI Coding Workflows: From Cloud to Local*. See [Credits](#credits) for what came from the course and what changed.

## How to use this repo

You do not work inside this repo. Create a project folder of your own, copy `starter/specs/` into it as `specs/`, and follow [prompts.md](prompts.md) from Stage 0.

| Path | Purpose |
|---|---|
| `starter/specs/mission.md` | Describes the app, its purpose and the experience it should provide |
| `starter/specs/tech-stack.md` | Records the required technologies and constraints |
| `starter/specs/roadmap.md` | Breaks the app into three phases that coding agents can plan and implement |
| `prompts.md` | Every prompt used in the workshop, with notes on when to run each one |
| `demo/` | A finished Prompt Pantry built from the specs (all three phases), for reference and for the live demo |
| `setup.mjs` | Pre-workshop setup and check script (see [Before you arrive](#before-you-arrive)) |
| `test/` | Tests for `setup.mjs`, including Docker sandbox runs |
| `bench/task-board/` | Benchmarks for coding models: a build-from-spec benchmark and a task-type lab (single-file fix, multi-file debug, cross-file feature, migration, contract change, code review) with hidden tests, scorers and a token and cost audit. Runs Claude agents or any OpenAI-compatible model (free-tier or self-hosted). See its [README](bench/task-board/README.md) and the [lab README](bench/task-board/lab/README.md). To run the model ladder in the workshop (cloud and local models, with time and cost), see [bench/task-board/lab/workshop/WORKSHOP.md](bench/task-board/lab/workshop/WORKSHOP.md) |
| `harness/README.md` | Draft notes for connecting the DeepSeek harness to OpenRouter and local models, and for subagent models |
| `.gitignore` | Excludes `node_modules`, build output, local env files and editor files |

## Before you arrive

Do this at home. The setup downloads about 1 GB, which conference Wi-Fi won't handle for a full room.

### 1. Install two things by hand

- [Git](https://git-scm.com/downloads/)
- [Node.js](https://nodejs.org/), current LTS: 22.22+ or 24.15+ (the workshop's test tools don't run on Node 20)

### 2. Clone the repo and run the setup script

```bash
git clone https://github.com/sahilsharma2408/sc-ai-coding-workflows-files.git
cd sc-ai-coding-workflows-files
node setup.mjs
```

The script works on macOS, Linux and Windows. It:

- checks Git, your Git identity, Node.js, npm and your editor
- checks Claude Code is installed and signed in, and offers to install it
- downloads the DeepSeek harness (about 900 MB, a few minutes), starts its web UI on `127.0.0.1:3080` (or the next free port up to 3089, if another app uses it) to check it works, then stops it
- checks that the DeepSeek models are on OpenRouter and, if you have your own key, that it works and has credit (the key is never saved or printed)
- installs the demo app and runs its tests, which also caches the packages you'll need in Stage 0
- installs the scorer for the model ladder in `bench/task-board` (about 170 MB, skip with `--skip-bench`)
- looks for a model server already running on your laptop (Ollama, LM Studio or llama.cpp) and lists its models
- creates your workshop project at `~/prompt-pantry` with `specs/` and a first commit
- says whether your laptop can handle the local stages

It ends with a summary, then opens the DeepSeek web UI in your browser and leaves it running (not with `--check`). Fix anything marked ✖ before the workshop. Items marked ! are worth a look but won't block you. Run `node setup.mjs --check` on the day to recheck without changing anything, and `node setup.mjs --help` for all options (for example `--project <dir>`).

### 3. Models and keys

| What | Who provides it |
|---|---|
| **A frontier coding agent**: Claude Code with a paid Claude plan or Anthropic API key | **You.** We demo Stage 1 in Claude Code. If you already pay for another frontier-model agent (Codex, Cursor, Gemini CLI and so on), you can follow Stage 1 with that instead. We can't provide this access. |
| **DeepSeek V4 Pro and V4 Flash on OpenRouter**, for Stages 2 and 3 | **We do, if you need it.** Bring your own [OpenRouter key](https://openrouter.ai/keys) with about $10 of credit if you can, which covers the whole workshop. Without one, ask the speakers at the start of the session for a workshop key with limited credit. |

Copy an OpenRouter key when you create it, because you can't view it again. Never commit it to Git.

### 4. Also install

- An editor: [Orca](https://www.onorca.dev/) or [VS Code](https://code.visualstudio.com/download)
- Optional: the DeepSeek harness [desktop app](https://www.deepseek.com/en/harness/) (macOS on Apple silicon, or Windows). The web UI the script sets up works too: `npx @deepseek-ai/dsh web`

### Hardware

Stages 3 and 4 run models on your own laptop. Apple silicon or a GPU with 16 GB+ of memory works best. On a smaller machine you can still do Stages 1 and 2, which run in the cloud.

### Helpful to know

- Basic Git and terminal use
- React, TypeScript, Vite and Vitest
- Some experience with an AI coding agent

### Testing the setup script

```bash
node --test test/setup.test.mjs   # unit and integration tests, no network or keys needed
test/sandbox.sh                   # full runs in clean Docker containers (Node 22 and 24; Node 18 and 20 must be rejected)
```

## Demo app

`demo/` holds a finished Prompt Pantry that meets every task in `starter/specs/roadmap.md`. Use it to see the end result, or to compare against what each AI setup produces. Do not copy it into your own project before a run, because that would defeat the comparison.

```bash
cd demo
npm install
npm run dev     # http://localhost:5173
npm test        # 10 tests across the three phases
```

## Credits

This repository is based on the course materials for [*AI Coding Workflows: From Cloud to Local*](https://www.deeplearning.ai/) by DeepLearning.AI, built in partnership with JetBrains. The original files are at [https-deeplearning-ai/sc-ai-coding-workflows-files](https://github.com/https-deeplearning-ai/sc-ai-coding-workflows-files).

What came from the course:

- The workshop structure: building the same app across cloud, hybrid and local setups and comparing the results
- The spec format (`mission.md`, `tech-stack.md`, `roadmap.md`) and the phase-by-phase roadmap
- The prompt patterns in `prompts.md`, including the subagent and local-implementer prompts

What changed for this workshop:

- The app is Prompt Pantry, a React + TypeScript app, in place of the course's Python app
- The specs, prompts and harness notes target Claude Code, the DeepSeek harness and OpenRouter
- `demo/` is new

All credit for the original course design goes to its authors. The upstream repository does not state a license, so contact DeepLearning.AI before reusing the course material beyond this workshop.
