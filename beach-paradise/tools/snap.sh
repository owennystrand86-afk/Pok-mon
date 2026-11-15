#!/bin/sh
# Fast, deterministic test run:  tools/snap.sh steps.json
# The game draws nothing by itself; time advances only through "sim" steps and pictures are taken with "grab" steps.
# A logic-only steps file (no "grab") runs in seconds. Environment as for tools/shot.sh (W, H, OUT, QUALITY, FILE, TOUCH).
f="${1#@}"
DRAW=0 exec "$(dirname "$0")/shot.sh" /dev/null "@$f"
