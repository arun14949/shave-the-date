"""Keep only the added facial hair from the generated beard photograph."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "assets/source/aakash-bald-generated.png"
BEARDED = ROOT / "assets/source/aakash-full-beard-generated.png"
OUTPUT = ROOT / "assets/aakash-beard-overlay.png"


def main() -> None:
    base = Image.open(BASE).convert("RGB")
    bearded = Image.open(BEARDED).convert("RGB")
    if base.size != bearded.size:
        raise ValueError("The beard edit must keep the base photo dimensions")
    a = np.asarray(base, dtype=np.float32)
    b = np.asarray(bearded, dtype=np.float32)
    yy, xx = np.mgrid[:base.height, :base.width]
    base_luma = a[..., 0] * .28 + a[..., 1] * .59 + a[..., 2] * .13
    beard_luma = b[..., 0] * .28 + b[..., 1] * .59 + b[..., 2] * .13
    darker = np.clip((base_luma - beard_luma - 9) / 48, 0, 1)
    vertical = np.clip((yy - 710) / 50, 0, 1) * np.clip((1230 - yy) / 80, 0, 1)
    horizontal = np.clip((xx - 190) / 50, 0, 1) * np.clip((890 - xx) / 50, 0, 1)
    alpha = Image.fromarray(np.uint8(np.round(darker * vertical * horizontal * 255)), "L")
    alpha = alpha.filter(ImageFilter.GaussianBlur(.7))
    rgba = bearded.convert("RGBA")
    rgba.putalpha(alpha)
    rgba.save(OUTPUT, optimize=True)
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
