"""Make an aligned scalp layer to reveal when Aakash's photo hair is cut."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/source/aakash-bald-reference.png"
OUTPUT = ROOT / "assets/aakash-bald-scalp-overlay.png"
CROP = (130, 50, 950, 650)


def main() -> None:
    image = Image.open(SOURCE).convert("RGB").crop(CROP)
    rgb = np.asarray(image, dtype=np.float32)
    yy, xx = np.mgrid[CROP[1]:CROP[3], CROP[0]:CROP[2]]
    # Warm scalp against the neutral studio background. Fade through the
    # forehead where the existing fitted face already has matching pixels.
    warm = np.clip((rgb[..., 0] - rgb[..., 1] - 9) / 24, 0, 1)
    bottom = np.clip((625 - yy) / 135, 0, 1)
    temple = np.clip((yy - 430) / 100, 0, 1)
    left = 145 + 115 * temple
    right = 935 - 115 * temple
    sides = np.clip((xx - left) / 35, 0, 1) * np.clip((right - xx) / 35, 0, 1)
    alpha = Image.fromarray(np.uint8(np.round(warm * bottom * sides * 255)), "L")
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.0))
    rgba = image.convert("RGBA")
    rgba.putalpha(alpha)
    rgba.save(OUTPUT, optimize=True)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
