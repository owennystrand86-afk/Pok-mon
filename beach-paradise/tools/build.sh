#!/bin/sh
# Build the game: every file in src/ joined in name order into ONE html page, with the packed
# 3D assets (models/out/*.bpk, if any) embedded.
#   tools/build.sh            -> build/index.html   (for testing; not committed)
#   tools/build.sh --release  -> index.html         (the published single-file game)
# For test pages only (refused together with --release):
#   --out FILE      write the page there instead of build/index.html
#   --assets DIR    also embed the .bpk files of DIR (repeatable). For assets that must never ship: test
#                   models exported with kit.export_bpk(..., out_dir=DIR). A pack in DIR replaces the one
#                   of the same name from models/out, so a variant of a model can be tried the same way.
#   --no-assets     embed no assets at all (the game must boot without them)
# Open a test page with FILE=file://$PWD/<page> tools/snap.sh steps.json
set -e
cd "$(dirname "$0")/.."
out=build/index.html; dirs="--dir models/out"; release=0; test=0
while [ $# -gt 0 ]; do
  case "$1" in
    --release) out=index.html; release=1 ;;
    --out) [ -n "$2" ] || { echo "build.sh: --out needs a file" >&2; exit 2; }; out="$2"; test=1; shift ;;
    --assets) [ -d "$2" ] || { echo "build.sh: --assets needs a folder, got '$2'" >&2; exit 2; }; dirs="$dirs --dir $2"; test=1; shift ;;
    --no-assets) dirs="--none"; test=1 ;;
    *) echo "build.sh: unknown option $1" >&2; exit 2 ;;
  esac
  shift
done
if [ "$release" = 1 ] && [ "$test" = 1 ]; then echo "build.sh: --release takes no other option (a release holds models/out and nothing else)" >&2; exit 2; fi
mkdir -p build "$(dirname "$out")"
tmp=build/.page.$$.tmp
trap 'rm -f "$tmp"' EXIT
cat $(ls src/*.html src/*.js | sort) > "$tmp"
if [ -f tools/pack_assets.py ]; then python3 tools/pack_assets.py "$tmp" $dirs; fi
mv "$tmp" "$out"
wc -c "$out"
