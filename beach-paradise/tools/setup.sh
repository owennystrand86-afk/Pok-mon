#!/bin/sh
# One-time setup of the tools this project's asset pipeline and tests use (idempotent).
#   Blender as a Python module (bpy) in /opt/bl/venv   -> run model scripts with /opt/bl/venv/bin/python
#   three.js r170 for the offline test harness          -> /opt/bl/node_modules/three
set -e
mkdir -p /opt/bl
[ -x /opt/bl/venv/bin/python ] || python3.13 -m venv /opt/bl/venv
/opt/bl/venv/bin/python -c "import bpy" 2>/dev/null || /opt/bl/venv/bin/pip install -q bpy==5.3.0 numpy pillow
[ -d /opt/bl/node_modules/three ] || npm install --prefix /opt/bl three@0.170.0 --silent
/opt/bl/venv/bin/python -c "import bpy; print('Blender', bpy.app.version_string)"
