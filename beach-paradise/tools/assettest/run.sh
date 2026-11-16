#!/bin/sh
# Regression tests of the 3D asset pipeline (models/lib/bpkit.py -> tools/pack_assets.py -> src/15-assets.js).
#   tools/assettest/run.sh            the toolkit smoke test, then the torture asset through exporter, packer and loader,
#                                     compared in the page with ground truth worked out in Blender (a logic run: seconds)
#   tools/assettest/run.sh --light    also the lighting checks (occlusion in sun and shade, haze, under water): they draw
#                                     frames, so they wait in the picture queue. On quality low two of them fail by design
#                                     (no shadow maps there, so nothing is "lit by the sky alone").
#   tools/assettest/run.sh --bench    decode times and memory for a 100k and a 500k triangle pack
# QUALITY=low|medium|high as for tools/snap.sh. Everything is written to build/torture/ and nothing ships: the torture
# asset is exported with out_dir and embedded in a test page with tools/build.sh --assets.
# Run it after any change to bpkit.py's exporter, pack_assets.py or 15-assets.js. Every line must start with PASS.
set -e
cd "$(dirname "$0")/../.."
py=/opt/bl/venv/bin/python; t=build/torture; mkdir -p $t
case "$1" in
  --bench)
    for n in 100 500; do
      $py tools/assettest/bench.py $n | grep -E 'STATS|WARNING' || true
      python3 tools/assettest/bench_steps.py $n | grep -E '^bench|^assets'
      FILE=file://$PWD/$t/bench$n.html tools/snap.sh $t/bench$n.json | grep -E 'boot_loadAssets|ERROR|CONSOLE' -A3
    done; exit 0 ;;
esac
$py tools/assettest/kit_smoke.py | grep -E 'FAIL|checks' || true
$py tools/assettest/torture.py | tail -2
tools/build.sh --assets $t/out --out $t/index.html | tail -1
python3 tools/assettest/mksteps.py
FILE=file://$PWD/$t/index.html tools/snap.sh $t/steps.json > $t/run.log 2>&1 || true
[ "$1" = "--light" ] && { FILE=file://$PWD/$t/index.html W=800 H=450 OUT=$t/light tools/snap.sh $t/light_steps.json >> $t/run.log 2>&1 || true; }
grep -E 'FAIL|STEP .*ERROR|CONSOLE PROBLEMS|NOT READY' -A3 $t/run.log || true
echo "$(grep -c '  PASS' $t/run.log) passed, $(grep -c '  FAIL' $t/run.log) failed, $(grep -c 'no console errors' $t/run.log) run(s) without console problems (log: $t/run.log)"
