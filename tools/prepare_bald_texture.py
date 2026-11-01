"""Align the AI-edited bald scalp with the existing photo-fitted face mesh.

The edited portrait has the same pixel dimensions as the original. Keep the
original eyes, nose, mouth, and lower face exactly; blend only the forehead
transition, then use the original mesh crop so its UVs stay aligned.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = ROOT / "assets/source/aakash-clean-reference.png"
BALD_EDIT = ROOT / "assets/source/aakash-bald-generated.png"
BALD_REFERENCE = ROOT / "assets/source/aakash-bald-reference.png"
FACE_TEXTURE = ROOT / "assets/aakash-face-bald.jpg"
# Crop made by build_face.py for the original reference and its UV coordinates.
FACE_CROP = (197, 365, 856, 1153)


def main() -> None:
    original = Image.open(ORIGINAL).convert("RGB")
    bald = Image.open(BALD_EDIT).convert("RGB")
    if bald.size != original.size:
        raise ValueError(f"Bald edit must remain {original.size}, got {bald.size}")
    mask = Image.new("L", original.size)
    def fade(start: int, end: int, value: int) -> float:
        t = max(0.0, min(1.0, (value - start) / (end - start)))
        return t * t * (3 - 2 * t)

    mask.putdata([
        round(255 * max(
            1 - fade(475, 535, y),
            max(1 - fade(235, 335, x), fade(745, 845, x)) * (1 - fade(750, 850, y)),
        ))
        for y in range(original.height) for x in range(original.width)
    ])
    aligned = Image.composite(bald, original, mask)
    aligned.save(BALD_REFERENCE)
    aligned.crop(FACE_CROP).save(FACE_TEXTURE, "JPEG", quality=93, subsampling=0)
    print(f"Wrote {FACE_TEXTURE} ({FACE_CROP[2] - FACE_CROP[0]}x{FACE_CROP[3] - FACE_CROP[1]})")


if __name__ == "__main__":
    main()
