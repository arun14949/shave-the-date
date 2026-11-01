"""Lift Aakash's photographed dark curls into an aligned transparent layer."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/source/aakash-clean-reference.png"
OUTPUT = ROOT / "assets/aakash-hair-overlay.png"
CROP = (130, 50, 950, 650)


def main() -> None:
    source = Image.open(SOURCE).convert("RGB").crop(CROP)
    rgb = np.asarray(source, dtype=np.float32)
    height, width = rgb.shape[:2]
    yy, xx = np.mgrid[CROP[1]:CROP[3], CROP[0]:CROP[2]]
    luminance = rgb[..., 0] * .28 + rgb[..., 1] * .59 + rgb[..., 2] * .13
    # The source has dark hair against gray and warm skin. Keep translucent
    # flyaways while excluding the eyebrows below the photographed hairline.
    alpha = np.clip((122 - luminance) / 65, 0, 1) ** 1.1
    lower_edge = 455 + 90 * np.minimum(1, (np.abs(xx - 540) / 360) ** 2)
    alpha *= np.clip((lower_edge - yy) / 75, 0, 1)
    alpha *= np.clip((xx - 135) / 25, 0, 1) * np.clip((945 - xx) / 25, 0, 1)
    alpha *= np.clip((yy - 51) / 20, 0, 1)
    alpha = Image.fromarray(np.uint8(np.round(alpha * 255)), "L").filter(ImageFilter.GaussianBlur(.55))
    rgba = source.convert("RGBA")
    rgba.putalpha(alpha)
    rgba.save(OUTPUT, optimize=True)
    print(f"Wrote {OUTPUT} ({width}x{height})")


if __name__ == "__main__":
    main()
