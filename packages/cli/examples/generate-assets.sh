#!/usr/bin/env bash
# Copyright (C) 2026 by Pedro Sanders. MIT.
#
# Synthesizes the small clips `examples/spec.json` references, via
# ffmpeg's `lavfi` virtual sources — no real footage needed. Mirrors
# `packages/core/test/fixtures/generateSampleVideo.ts`'s approach: never
# commit the generated binaries (see `assets/` in this repo's .gitignore).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSETS_DIR="$DIR/assets"
mkdir -p "$ASSETS_DIR"

make_clip() {
  local name="$1" duration="$2" color="$3" tone="$4"
  local out="$ASSETS_DIR/$name"
  if [ -f "$out" ]; then
    echo "exists, skipping: $name"
    return
  fi
  ffmpeg -y \
    -f lavfi -i "color=c=${color}:size=640x360:rate=30:duration=${duration}" \
    -f lavfi -i "sine=frequency=${tone}:duration=${duration}" \
    -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$out"
  echo "generated: $name"
}

# interview.mp4's own audio needs to cover its 3s on-screen scene plus the
# following 2s continuing B-roll scene (see spec.json) — 6s of margin.
make_clip "interview.mp4" 6 blue 440
make_clip "broll-1.mp4" 2 green 220
make_clip "broll-2.mp4" 2 red 220
make_clip "interview-2.mp4" 3 purple 880

# webcam.mp4 — a PIP overlay's own footage (see overlays-spec.json), long
# enough to cover the two scenes it appears over.
make_clip "webcam.mp4" 5 orange 660

echo "Done. Try:"
echo "  node ../bin/run.js validate spec.json"
echo "  node ../bin/run.js render spec.json"
