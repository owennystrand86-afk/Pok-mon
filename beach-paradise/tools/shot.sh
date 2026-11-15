#!/bin/sh
# Run the game in a headless browser:  tools/shot.sh <final.png> @steps.json   (see tools/shot.cjs for the steps)
# Prefer tools/snap.sh (the same with DRAW=0): deterministic and many times faster.
# The machine has no GPU and few cores. A run that draws pictures uses all of them, so only ONE such run happens at a
# time for everyone on this machine and the others wait their turn. Logic-only runs (DRAW=0 and no "grab"/"shot" step)
# take seconds and have their own two slots, so they never wait behind a picture run. Never start a browser any other way.
dir="$(dirname "$0")"
base=/tmp/bp-shot; slots=1
if [ "$DRAW" = "0" ]; then
  f="${2#@}"
  if [ -f "$f" ] && ! grep -q -e '"grab"' -e '"shot"' "$f"; then base=/tmp/bp-logic; slots=2; fi
fi
t0=$(date +%s)
while :; do
  i=1
  while [ "$i" -le "$slots" ]; do
    lock=$base.lock; [ "$i" -gt 1 ] && lock=$base.$i.lock
    exec 9>>"$lock"
    if flock -n 9; then
      w=$(( $(date +%s) - t0 )); [ "$w" -gt 5 ] && echo "waited $w s for a free browser slot"
      exec timeout "${SHOT_TIMEOUT:-1500}" node "$dir/shot.cjs" "$@"
    fi
    exec 9>&-
    i=$((i + 1))
  done
  sleep 2
done
