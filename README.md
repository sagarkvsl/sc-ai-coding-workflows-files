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
| `harness/README.md` | Draft notes for connecting the DeepSeek harness to OpenRouter and local models, and for subagent models |
| `.gitignore` | Excludes `node_modules`, build output, local env files and editor files |

## Prerequisites

- [Git](https://git-scm.com/downloads/)
- [Node.js](https://nodejs.org/) (current LTS)
- An editor: [Orca](https://www.onorca.dev/) or [VS Code](https://code.visualstudio.com/download)
- [Claude Code](https://code.claude.com/docs/en/getting-started)
- The [DeepSeek harness](https://www.deepseek.com/en/harness/)
- An [OpenRouter](https://openrouter.ai/docs/quickstart) account and API key
- Later, for the local stages: a local model runtime (to be decided)

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
