# MotionKit

A programmable, branded video engine exposed through MCP. An AI agent describes a video in
natural language, an agent layer turns that into a structured, versioned Video Specification
(Zod schema), and MotionKit validates and renders it deterministically via Remotion.

The video engine ships in phases via OpenSpec changes (see `CLAUDE.md` for the build plan and
`openspec/` for specs/proposals). Phase 1 (Foundation) is in: a versioned Video Specification
schema, a non-throwing structured-error validator, and a deterministic Remotion render pipeline
for the `16:9`/`9:16` formats, with `motionkit validate`/`motionkit render` CLI commands driving
them.

## Packages

- `packages/core` (`@motionkit/core`) — shared Zod schemas, types, error classes, utils, and the
  MotionKit engine: the Video Specification schema (`src/video-spec/`), its validator
  (`src/validation/`), and the Remotion render pipeline (`src/rendering/`).
- `packages/mcp` (`@motionkit/mcp`) — the MCP server AI agents talk to (still a placeholder
  `ping` tool — the real tool surface is Phase 4).
- `packages/cli` (`@motionkit/cli`) — an oclif CLI for local/scripted use: `motionkit validate
<spec.json>` and `motionkit render <spec.json>`. See `packages/cli/examples/` for a runnable
  example.

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

| Script              | Description                                         |
| :------------------ | :-------------------------------------------------- |
| `npm run build`     | `tsc -b` across all workspaces (project references) |
| `npm run lint`      | ESLint (flat config) across the repo                |
| `npm run typecheck` | `tsc -b --force`                                    |
| `npm test`          | mocha unit tests in every package                   |
