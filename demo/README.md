# Prompt Pantry: demo

A finished Prompt Pantry built from [`../starter/specs/`](../starter/specs/). It covers Phase 1 (shell and home page), Phase 2 (pantry board) and Phase 3 (add prompt form) of the roadmap.

```bash
npm install
npm run dev     # start the dev server
npm test        # vitest run, one pass
npm run build   # type-check and build
```

| Path | Roadmap phase |
|---|---|
| `src/main.tsx`, `src/App.tsx`, `src/components/Navbar.tsx`, `src/pages/HomePage.tsx` | Phase 1 |
| `src/types.ts`, `src/data/seedPrompts.ts`, `src/components/PromptCard.tsx`, `src/pages/PantryPage.tsx` | Phase 2 |
| `src/components/AddPromptForm.tsx` | Phase 3 |
| `src/App.test.tsx`, `src/pages/PantryPage.test.tsx` | Tests for all three phases |
