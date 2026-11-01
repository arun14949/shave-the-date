"""Extract aligned hair and beard layers from edits of the exact bald portrait."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
BASE = np.asarray(Image.open(ROOT / 'assets/source/aakash-bald-generated.png').convert('RGB'), dtype=np.float32)
HEIGHT, WIDTH = BASE.shape[:2]
Y, X = np.mgrid[:HEIGHT, :WIDTH]


def luma(rgb):
    return rgb[..., 0] * .28 + rgb[..., 1] * .59 + rgb[..., 2] * .13


def save_layer(source_name, output_name, spatial, threshold=6, contrast=58):
    edited = Image.open(ROOT / 'assets/source' / source_name).convert('RGB')
    if edited.size != (WIDTH, HEIGHT):
        raise ValueError(f'{source_name} must match the base portrait dimensions')
    edited_rgb = np.asarray(edited, dtype=np.float32)
    darkness = np.clip((luma(BASE) - luma(edited_rgb) - threshold) / contrast, 0, 1)
    alpha = np.uint8(np.round(darkness * spatial * 255))
    alpha_image = Image.fromarray(alpha, 'L').filter(ImageFilter.GaussianBlur(.65))
    output = edited.convert('RGBA')
    output.putalpha(alpha_image)
    path = ROOT / 'assets' / output_name
    output.save(path, optimize=True)
    print(f'Wrote {path}')


def main():
    distance = np.abs(X - 540) / 350
    hair_lower = 445 + 185 * distance ** 2
    scalp = np.clip((hair_lower - Y) / 33, 0, 1)
    scalp *= np.clip((X - 125) / 32, 0, 1) * np.clip((960 - X) / 32, 0, 1)
    scalp *= np.clip((Y - 30) / 20, 0, 1)
    left_burn = np.clip((X - 210) / 20, 0, 1) * np.clip((280 - X) / 23, 0, 1)
    right_burn = np.clip((X - 805) / 23, 0, 1) * np.clip((875 - X) / 20, 0, 1)
    burns = np.maximum(left_burn, right_burn)
    burns *= np.clip((Y - 530) / 25, 0, 1) * np.clip((805 - Y) / 55, 0, 1)
    save_layer('aakash-hair-fitted-generated.png', 'aakash-hair-fitted-overlay.png', np.maximum(scalp, burns), contrast=65)
    save_layer('aakash-medium-hair-generated.png', 'aakash-medium-hair-overlay.png', np.maximum(scalp, burns), contrast=65)
    save_layer('aakash-buzz-hair-generated.png', 'aakash-buzz-hair-overlay.png', np.maximum(scalp, burns), contrast=65)

    side = np.clip((np.abs(X - 540) - 210) / 115, 0, 1)
    upper = 735 - side * 165
    face_hair = np.clip((Y - upper) / 34, 0, 1)
    face_hair *= np.clip((1265 - Y) / 70, 0, 1)
    face_hair *= np.clip((X - 155) / 35, 0, 1) * np.clip((925 - X) / 35, 0, 1)
    save_layer('aakash-full-beard-generated.png', 'aakash-beard-overlay.png', face_hair, contrast=55)
    save_layer('aakash-thick-beard-generated.png', 'aakash-thick-beard-overlay.png', face_hair, contrast=55)


if __name__ == '__main__':
    main()
