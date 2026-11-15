#!/bin/sh
# Syntax-check the game's module script in a built page (default build/index.html).
cd "$(dirname "$0")/.."
f=${1:-build/index.html}
python3 - "$f" <<'PY'
import re,sys
s=open(sys.argv[1]).read()
m=re.search(r'<script type="module">(.*?)</script>',s,re.S)
open('build/.check.mjs','w').write(m.group(1))
PY
node --check build/.check.mjs && echo "SYNTAX OK"
