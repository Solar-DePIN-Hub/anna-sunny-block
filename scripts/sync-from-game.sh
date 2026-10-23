#!/usr/bin/env bash
# Shows how bundle/ differs from the web game (github.com/Solar-DePIN-Hub/sunny-block).
# Base: sunny-block commit 46a7ea2. Anna-only files: bundle/anna/*, bundle/icon.svg.
# Patched game files: bundle/index.html, bundle/src/game.js, bundle/src/ui.js (AI hooks).
set -euo pipefail
GAME=${1:-/workspace/games/sunny-block}
HERE=$(cd "$(dirname "$0")/.." && pwd)
for f in index.html src assets; do
  diff -ru "$GAME/$f" "$HERE/bundle/$f" || true
done
