# Fonoster Intro Demo

A real (non-synthetic) MotionKit demo: A-roll intro → PIP+B-roll → A-roll → PIP+B-roll again.
Fonoster brand, PIP bubble as a large rounded square. Two format variants:

- `spec-9x16.json` — the B-roll (browser demo) scenes slowly pan left-to-right, since in a
  portrait frame the browser recording has real horizontal slack to reveal.
- `spec-16x9.json` — same sequence, no pan (the wider frame doesn't need one).

## Files, in `assets/`

| File                   | Used as                                  | Scene duration it must cover |
| :--------------------- | :--------------------------------------- | :--------------------------- |
| `phone-intro.mp4`      | Scene 0 (`a_roll`, full screen)          | 7s                           |
| `phone-pip-1.mp4`      | Overlay on scene 1 (PIP, `audio: "own"`) | 10s                          |
| `browser-demo-1.mov`   | Scene 1 (`b_roll`, browser frame)        | 10s                          |
| `phone-describing.mp4` | Scene 2 (`a_roll`, full screen)          | 5s                           |
| `phone-pip-2.mp4`      | Overlay on scene 3 (PIP, `audio: "own"`) | 10s                          |
| `browser-demo-2.mov`   | Scene 3 (`b_roll`, browser frame)        | 10s                          |

Both `.mov` and `.mp4` work — MotionKit doesn't care about container/codec beyond what
`ffmpeg` can decode.

## Render

```bash
cd demos/fonoster-intro
node ../../packages/cli/bin/run.js validate spec-9x16.json
node ../../packages/cli/bin/run.js render spec-9x16.json

node ../../packages/cli/bin/run.js validate spec-16x9.json
node ../../packages/cli/bin/run.js render spec-16x9.json
```

The brand (`brands/fonoster.brand.json`) has real colors pulled from fonoster.com. PIP bubble
is `size: "lg"` (330px) and `shape: "rounded_square"` on both overlays in both specs.
