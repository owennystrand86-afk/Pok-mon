"""Page and steps file for one benchmark pack:  tools/assettest/bench_steps.py <thousand triangles>   (after bench.py)"""
import base64, json, os, re, subprocess, sys
n = sys.argv[1]
page = 'build/torture/bench%s.html' % n
open(page, 'w').write(''.join(open(os.path.join('src', f), encoding='utf-8').read() for f in sorted(os.listdir('src'))))
print(subprocess.run(['python3', 'tools/pack_assets.py', page, '--dir', 'build/torture/bench%s' % n], capture_output=True, text=True).stdout)
html = open(page, encoding='utf-8').read()
m = re.search(r'<script id="bp-assets"[^>]*data-raw="(\d+)"[^>]*>([^<]*)</script>', html)
js = """(async () => { const E = __bpEval, A = E('ASSETS'), b64 = __packed.b64, rawLen = __packed.raw, now = () => performance.now();
  const boot = { ms: +A.ms.toFixed(1), models: A.count, tris: A.tris };
  const best = {};
  const keep = (k, v) => { best[k] = Math.min(best[k] ?? 1e9, v); };
  let raw;
  for (let i = 0; i < 3; i++) {
    let t = now(); const u8 = E('assetB64')(b64); keep('base64', now() - t);
    t = now(); raw = await E('assetInflate')(u8, rawLen); keep('inflate_native', now() - t);
    t = now(); const r2 = E('assetInflateJS')(u8, rawLen); keep('inflate_js', now() - t);
    if (r2.length !== raw.length) throw new Error('lengths differ');
    t = now(); E('assetParse')(raw); keep('parse_decode_arrays', now() - t);
  }
  const name = [...A.by.keys()][0];
  let t = now(); const g = E('assetGeometry')(name, {}); keep('make_geometry', now() - t);
  let bytes = 0; const per = {};
  for (const [k, a] of Object.entries(g.attributes)) { per[k] = a.array.BYTES_PER_ELEMENT * a.itemSize; bytes += a.array.byteLength; }
  const nv = g.attributes.position.count, ib = g.index.array.byteLength;
  for (const k in best) best[k] = +best[k].toFixed(1);
  return JSON.stringify({ boot_loadAssets: boot, best_of_3_ms: best, packed_base64_chars: b64.length, raw_bytes: rawLen, vertices: nv, triangles: g.index.count / 3,
    gpu_bytes_per_vertex: per, vertex_bytes: +(bytes / nv).toFixed(1), index_bytes_per_vertex: +(ib / nv).toFixed(1), total_gpu_MB: +((bytes + ib) / 1048576).toFixed(2) }); })()"""
steps = [{"eval": "__T.setup({quality:'$QUALITY', hour:13, hud:false})"},
         {"eval": "window.__packed = " + json.dumps(dict(b64=m.group(2), raw=int(m.group(1)))) + "; 'pack'"},
         {"eval": js}]
json.dump(steps, open('build/torture/bench%s.json' % n, 'w'))
