#!/usr/bin/env python3
"""Tile pictures into one labelled sheet, for comparing views side by side.

  tools/sheet.py out.png a.png b.png c.png ...            a grid (default 3 columns)
  tools/sheet.py out.png --cols 2 before.png after.png    before | after
  tools/sheet.py out.png --pairs dirA dirB                every picture name present in both folders, A | B per row
Options: --cols N, --width W (width of each cell in pixels, default 640), --crop x,y,w,h (fractions 0..1 of each
picture, applied before scaling: zoom on a detail). Each cell is labelled with its file name.
"""
import os, sys
try:
    from PIL import Image, ImageDraw
except ImportError:
    os.execv('/opt/bl/venv/bin/python', ['/opt/bl/venv/bin/python'] + sys.argv)

def main():
    a = sys.argv[1:]
    if len(a) < 2: print(__doc__); sys.exit(1)
    out, a = a[0], a[1:]
    cols, width, crop, pairs = 3, 640, None, None
    files = []
    i = 0
    while i < len(a):
        if a[i] == '--cols': cols = int(a[i + 1]); i += 2
        elif a[i] == '--width': width = int(a[i + 1]); i += 2
        elif a[i] == '--crop': crop = [float(v) for v in a[i + 1].split(',')]; i += 2
        elif a[i] == '--pairs': pairs = (a[i + 1], a[i + 2]); i += 3
        else: files.append(a[i]); i += 1
    if pairs:
        names = sorted(n for n in os.listdir(pairs[0]) if n.lower().endswith('.png') and os.path.exists(os.path.join(pairs[1], n)))
        files = [os.path.join(d, n) for n in names for d in pairs]; cols = 2
    cells = []
    for f in files:
        im = Image.open(f).convert('RGB')
        if crop:
            W, H = im.size; x, y, w, h = crop
            im = im.crop((int(x * W), int(y * H), int((x + w) * W), int((y + h) * H)))
        h = round(im.size[1] * width / im.size[0])
        im = im.resize((width, h), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        label = os.path.join(os.path.basename(os.path.dirname(f)), os.path.basename(f)) if pairs else os.path.basename(f)
        d.rectangle([0, 0, 8 + 7 * len(label), 16], fill=(0, 0, 0)); d.text((4, 2), label, fill=(255, 255, 255))
        cells.append(im)
    if not cells: print('no pictures'); sys.exit(1)
    rows = (len(cells) + cols - 1) // cols
    ch = max(c.size[1] for c in cells)
    sheet = Image.new('RGB', (width * min(cols, len(cells)), ch * rows), (24, 24, 24))
    for k, c in enumerate(cells): sheet.paste(c, ((k % cols) * width, (k // cols) * ch))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    sheet.save(out)
    print('sheet', out, sheet.size, len(cells), 'pictures')

main()
