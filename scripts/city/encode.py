"""Blender PNG frames -> the website's WebP frames and label positions.

    python3 scripts/city/encode.py <render_dir>      (needs Pillow)

Writes apps/landing/public/city/{1600,1000}/f-NNN.webp and apps/landing/src/home/city-labels.json.
"""
import json, shutil, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
src = Path(sys.argv[1])
out = ROOT / 'apps/landing/public/city'
for width, quality in ((1600, 64), (1000, 58)):
    d = out / str(width)
    shutil.rmtree(d, ignore_errors=True)
    d.mkdir(parents=True)
    for i, png in enumerate(sorted(src.glob('frame-*.png')), start=1):
        im = Image.open(png).convert('RGB')
        if im.width != width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(d / f'f-{i:03d}.webp', 'WEBP', quality=quality, method=6)
shutil.copy(src / 'labels.json', ROOT / 'apps/landing/src/home/city-labels.json')
total = sum(f.stat().st_size for f in out.rglob('*.webp'))
print(f'{len(list((out / "1600").glob("*.webp")))} frames, {total / 1e6:.1f} MB across both sizes')
