# MotionKit

A programmable, branded video engine exposed through MCP. An AI agent describes a video in
natural language, an agent layer turns that into a structured, versioned Video Specification
(Zod schema), and MotionKit validates and renders it deterministically via Remotion.

This repository is currently a **bootstrap scaffold** — the baseline conventions, tooling, and
one worked example are in place; the actual video engine ships in phases via OpenSpec changes
(see `CLAUDE.md` for the build plan and `openspec/` for specs/proposals).

## Packages

- `packages/core` (`@motionkit/core`) — shared Zod schemas, types, error classes, utils, and
  (eventually) the Remotion render pipeline.
- `packages/mcp` (`@motionkit/mcp`) — the MCP server AI agents talk to.
- `packages/cli` (`@motionkit/cli`) — an oclif CLI for local/scripted use.

## Requirements

- Node.js >= 22 (see `.nvmrc`)

## Getting started

```bash
npm install
npm run build
npm run lint
npm run typecheck
npm test
```

## Workflow tooling

- **OpenSpec** — spec-driven development. Specs live in `openspec/specs/`, proposals in
  `openspec/changes/`. Use `/openspec:propose`, `/openspec:apply`, `/openspec:archive`. Scaffolded
  via `npx @fission-ai/openspec@latest init --tools claude`.
- **psstack commands** — this repo's `.claude/settings.json` registers the `psstack` marketplace
  and enables the `ps` plugin, so `/ps:*` commands (e.g. `/ps:ship`, `/ps:kaizen`) are available
  without per-machine setup.

## Scripts

| Script | Description |
| :--- | :--- |
| `npm run build` | `tsc -b` across all workspaces (project references) |
| `npm run lint` | ESLint (flat config) across the repo |
| `npm run typecheck` | `tsc -b --force` |
| `npm test` | mocha unit tests in every package |
