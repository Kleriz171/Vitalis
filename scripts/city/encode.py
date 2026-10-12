"""Blender PNG frames -> the website's WebP frames and label positions.

    python3 scripts/city/encode.py <render_dir>      (needs Pillow)

Writes apps/landing/public/city/{2560,1600,1000}/f-NNN.webp and apps/landing/src/home/city-labels.json.
"""
import json, shutil, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
src = Path(sys.argv[1])
out = ROOT / 'apps/landing/public/city'
for width, quality in ((2560, 74), (1600, 70), (1000, 62)):
    d = out / str(width)
    shutil.rmtree(d, ignore_errors=True)
    d.mkdir(parents=True)
    for i, png in enumerate(sorted(src.glob('frame-*.png')), start=1):
        im = Image.open(png).convert('RGB')
        if im.width > width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        im.save(d / f'f-{i:03d}.webp', 'WEBP', quality=quality, method=6)
shutil.copy(src / 'labels.json', ROOT / 'apps/landing/src/home/city-labels.json')
total = sum(f.stat().st_size for f in out.rglob('*.webp'))
print(f'{len(list((out / "1600").glob("*.webp")))} frames, {total / 1e6:.1f} MB across both sizes')

# Product renders (devices.py): keep real contact shadows, drop the shadow catcher's faint haze.
renders = src.parent / 'devices'
if renders.is_dir():
    (ROOT / 'apps/landing/public/renders').mkdir(parents=True, exist_ok=True)
    for png in sorted(renders.glob('*.png')):
        if png.stem == 'preview': continue
        im = Image.open(png).convert('RGBA')
        im.putalpha(im.getchannel('A').point(lambda v: 255 if v >= 250 else max(0, int((v - 40) * 255 / 210))))
        im.save(ROOT / f'apps/landing/public/renders/{png.stem}.webp', 'WEBP', quality=88, method=6)
    print('product renders converted')
