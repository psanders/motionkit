# Example Video Specification

A small spec for manually smoke-testing `motionkit validate`/`motionkit render` against real
(synthetic) assets, without an MCP client attached.

```bash
cd packages/cli/examples
./generate-assets.sh                    # synthesizes assets/*.mp4 via ffmpeg (gitignored)
node ../bin/run.js validate spec.json
node ../bin/run.js render spec.json     # writes spec.mp4 alongside spec.json
```

`spec.json` exercises every Phase 1 primitive: an `a_roll` scene, a `b_roll` scene that
defaults to continuing the preceding A-roll's audio, a `b_roll` scene that's explicitly
`"audio": "muted"` and declares a `fade` transition, and a second `a_roll` scene.
