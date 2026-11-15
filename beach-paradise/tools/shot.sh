#!/bin/sh
# Queue a browser run: only one headless browser runs at a time on this machine (they are slow in
# software GL and time out if they overlap). Same arguments and env as shot.cjs.
exec flock /tmp/bp-shot.lock timeout ${SHOT_TIMEOUT:-1500} node "$(dirname "$0")/shot.cjs" "$@"
