# AGENTS.md (Codex instructions)

## Workspace
- Work only inside this repository folder.
- Local path: /Users/aa/Codex_Projects/snake_game

## Git workflow
- Never push directly to main/master.
- Always create a feature branch: codex/<task>-YYYYMMDD
- Commit messages: short, imperative (e.g., "Add GitHub Pages README")
- After changes:
  1) run quick manual check (see below)
  2) commit
  3) push branch
  4) open a Pull Request with summary + checklist

## Manual check (for this repo)
- If it's a static web app:
  - python3 -m http.server 4173
  - open http://127.0.0.1:4173 and verify basic play works

## Files & style
- Keep dependency-free unless explicitly requested.
- Prefer relative paths (./) for GitHub Pages compatibility.

## Ask when needed
- If a task requires permissions outside the workspace or network access, ask first.
