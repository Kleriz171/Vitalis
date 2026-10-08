"""Builds every logo and app icon from brand/logo-source.png.

    python3 scripts/brand-assets.py        (needs Pillow: pip3 install pillow)

Re-run after changing the logo, then in apps/desktop `npx tauri icon ../../brand/desktop-icon.png -o src-tauri/icons`
for the desktop installers. Outputs are committed, so nobody else needs Pillow.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
TEAL = (14, 139, 127)  # the logo's own background, #0E8B7F


def save(img, *paths, size=None):
    if size:
        img = img.resize((size, size), Image.LANCZOS)
    for p in paths:
        p = ROOT / p
        p.parent.mkdir(parents=True, exist_ok=True)
        img.save(p, optimize=True)


def white_mark(src):
    """The white drawing alone, on transparent: alpha = how far a pixel is from the teal toward white."""
    r, g, b, _ = src.split()
    lum = Image.merge('RGB', (r, g, b)).convert('L')
    # Start the ramp a little above the teal: the source has faint compression noise around its corners.
    floor = int(0.299 * TEAL[0] + 0.587 * TEAL[1] + 0.114 * TEAL[2]) + 30
    alpha = lum.point(lambda v: 0 if v <= floor else min(255, (v - floor) * 255 // (255 - floor)))
    mark = Image.new('RGBA', src.size, (255, 255, 255, 0))
    mark.putalpha(alpha)
    return mark.crop(alpha.getbbox())


def on_canvas(mark, size, fill, background):
    """`mark` scaled so its larger side is `fill` × size, centred on a square canvas."""
    canvas = Image.new('RGBA', (size, size), background)
    scale = fill * size / max(mark.size)
    m = mark.resize((round(mark.width * scale), round(mark.height * scale)), Image.LANCZOS)
    canvas.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    return canvas


def rounded(img, radius_ratio=0.22):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.width - 1, img.height - 1), radius=round(img.width * radius_ratio), fill=255)
    out = img.copy()
    out.putalpha(mask)
    return out


src = Image.open(ROOT / 'brand/logo-source.png').convert('RGBA')
mark = white_mark(src)
TEAL_A = TEAL + (255,)
CLEAR = (0, 0, 0, 0)

# Masters (brand/): square full-bleed icon (platforms round it themselves), rounded tile, white mark.
icon = on_canvas(mark, 1024, 0.80, TEAL_A)        # same proportions as the source
tile = rounded(icon)
save(icon, 'brand/app-icon.png')
save(tile, 'brand/logo-tile.png')
save(on_canvas(mark, 1024, 1.0, CLEAR), 'brand/logo-mark-white.png')
# Desktop installers: macOS does not round icons itself; its grid puts an 824 px tile on a 1024 canvas.
desktop = Image.new('RGBA', (1024, 1024), CLEAR)
desktop.alpha_composite(tile.resize((824, 824), Image.LANCZOS), (100, 100))
save(desktop, 'brand/desktop-icon.png')

# Mobile app (Expo). Android adaptive icons crop to a circle inside the middle 66%: keep the mark in it.
save(icon, 'apps/native/assets/images/icon.png')
save(on_canvas(mark, 1024, 0.56, CLEAR), 'apps/native/assets/images/android-icon-foreground.png')
save(on_canvas(mark, 1024, 0.56, CLEAR), 'apps/native/assets/images/android-icon-monochrome.png')
save(tile, 'apps/native/assets/images/splash-icon.png', size=512)
save(tile, 'apps/native/assets/images/logo.png', size=192)
save(tile, 'apps/native/assets/images/favicon.png', size=96)

# Website and console.
save(tile, 'apps/landing/public/favicon.png', 'apps/desktop/public/favicon.png', size=96)
save(icon, 'apps/landing/public/apple-touch-icon.png', size=180)  # iOS rounds it itself
save(tile, 'apps/landing/src/assets/logo.png', 'apps/desktop/src/assets/logo.png', size=192)

# Wear OS: adaptive launcher foreground (432 px = 108 dp at xxxhdpi), notification silhouette, in-app tile.
res = 'apps/watch/wearos/app/src/main/res'
save(on_canvas(mark, 432, 0.56, CLEAR), f'{res}/drawable-nodpi/ic_launcher_foreground.png')
save(on_canvas(mark, 96, 0.9, CLEAR), f'{res}/drawable-nodpi/ic_notification.png')
save(tile, f'{res}/drawable-nodpi/logo.png', size=96)

# Apple Watch: one 1024 icon (the system masks it to a circle, so the mark sits a little smaller), in-app tile.
assets = 'apps/watch/watchos/Vitalis/Resources/Assets.xcassets'
save(on_canvas(mark, 1024, 0.72, TEAL_A).convert('RGB'), f'{assets}/AppIcon.appiconset/AppIcon.png')
save(tile, f'{assets}/Logo.imageset/Logo.png', size=96)

print('brand assets written')
