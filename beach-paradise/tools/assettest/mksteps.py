#!/usr/bin/env python3
"""Write the steps files of the test runs:  tools/assettest/mksteps.py [page.html] [out.json]   (tools/assettest/run.sh calls it)
    build/torture/steps.json        the logic run: checks.js, truth.json and the page's own asset pack (to compare the two inflate paths)
    build/torture/light_steps.json  the lighting run: light.js (it draws frames, so it queues with the picture runs)"""
import base64, json, os, re, sys, zlib
here = os.path.dirname(os.path.abspath(__file__))
tdir = os.path.join(os.path.dirname(here), 'torture') if os.path.basename(here) != 'torture' else here
root = here
while not os.path.exists(os.path.join(root, 'models', 'lib', 'bpkit.py')):
    root = os.path.dirname(root)
tdir = os.path.join(root, 'build', 'torture')
page = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tdir, 'index.html')
out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(tdir, 'steps.json')
html = open(page, encoding='utf-8').read()
m = re.search(r'<script id="bp-assets"[^>]*data-raw="(\d+)"[^>]*>([^<]*)</script>', html)
raw_len, b64 = int(m.group(1)), m.group(2)
raw = zlib.decompress(base64.b64decode(b64), -15)
assert len(raw) == raw_len
part = raw[:300000]


def deflate(data, level, strategy=zlib.Z_DEFAULT_STRATEGY):
    c = zlib.compressobj(level, zlib.DEFLATED, -15, 9, strategy)
    return base64.b64encode(c.compress(data) + c.flush()).decode()


packed = dict(b64=b64, raw=raw_len, part=len(part), stored=deflate(part, 0), fixed=deflate(part, 9, zlib.Z_FIXED), tiny=[deflate(b'A', 9), deflate(b'', 9)])
steps = [
    {"eval": "__T.setup({quality:'$QUALITY', hour:13, hud:false})"},
    {"eval": open(os.path.join(here, 'checks.js'), encoding='utf-8').read() + "\n'checks loaded: ' + __C.names.join(' ')"},
    {"eval": "window.__truth = " + open(os.path.join(tdir, 'truth.json')).read() + "; 'truth loaded: ' + Object.keys(__truth.objects).length + ' objects'"},
    {"eval": "window.__packed = " + json.dumps(packed) + "; 'pack loaded: ' + __packed.raw + ' bytes'"},
]
only = os.environ.get('ONLY')
for name in ['unknown', 'counts', 'nodes', 'bbox', 'vertices', 'tiny', 'winding', 'markers', 'analytic', 'materials', 'images', 'anchors', 'lod', 'static', 'instancing', 'inflate']:
    if not only or name in only.split(','):
        steps.append({"eval": "__C.run('%s')" % name})
json.dump(steps, open(out, 'w'))
print('%d steps -> %s (%.1f MB)' % (len(steps), os.path.relpath(out), os.path.getsize(out) / 1e6))
light = open(os.path.join(here, 'light.js'), encoding='utf-8').read()
lsteps = [{"eval": "__T.setup({quality:'$QUALITY', hour:13, hud:false})"}, {"eval": light + "\n'light checks loaded'"},
          {"eval": "__L.ao()"}, {"eval": "__L.fog()"}, {"eval": "__L.under()"}, {"grab": "$OUT/light_under_water.png"}, {"eval": "__L.done()"}]
json.dump(lsteps, open(os.path.join(tdir, 'light_steps.json'), 'w'))
