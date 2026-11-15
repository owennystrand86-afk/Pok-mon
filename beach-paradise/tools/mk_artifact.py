#!/usr/bin/env python3
"""Turn the released page (index.html) into the body-only form the claude.ai Artifact expects.
usage: tools/mk_artifact.py [out.html]   (default: build/beach-paradise.html)"""
import re, sys, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(root, 'index.html')).read()
for pat in (r'<!doctype html>\s*', r'</?html[^>]*>\s*', r'</?head[^>]*>\s*', r'</?body[^>]*>\s*', r'<meta charset[^>]*>\s*'):
    s = re.sub(pat, '', s, flags=re.I)
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'build', 'beach-paradise.html')
open(out, 'w').write(s); print(len(s), out)
