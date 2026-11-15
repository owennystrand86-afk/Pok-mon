#!/bin/sh
# Build the game: every file in src/ joined in name order into ONE html page, with the packed
# 3D assets (models/out/*.bpk, if any) embedded.
#   tools/build.sh            -> build/index.html   (for testing; not committed)
#   tools/build.sh --release  -> index.html         (the published single-file game)
set -e
cd "$(dirname "$0")/.."
out=build/index.html
[ "$1" = "--release" ] && out=index.html
mkdir -p build
cat $(ls src/*.html src/*.js | sort) > build/.page.tmp
if [ -f tools/pack_assets.py ]; then python3 tools/pack_assets.py build/.page.tmp; fi
mv build/.page.tmp "$out"
wc -c "$out"
