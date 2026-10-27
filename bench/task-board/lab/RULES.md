## Rules of the run

1. **One pass.** Make all your changes once. Do **not** run anything that executes the project or its tools: no `npm`, `npx`, `node`, `tsc`, `vitest`, `vite`, `yarn`, `pnpm` or `bun`. There is no run, check, fix loop. You may read and write files and re-read what you wrote. The dependencies are installed in the scorer, at the versions in `package.json`.
2. **At most 3 sub-agents in total**, counting any started by other sub-agents. Using none is fine.
3. **An orchestrator does not edit the repository itself.** It plans, shares the exact interfaces and hands the edits to its sub-agents. If you work alone, you make the edits yourself.
4. Stay inside this folder. Do not read anything outside it.
5. Change only what the task needs. Keep the existing code style, keep every existing test passing (update tests that the task makes obsolete), and do not delete tests.
