"""Fit a locally processed, textured 3D face to Aakash's reference portrait.

Run with the project's .venv Python after downloading the official MediaPipe
Face Landmarker task model into tools/models/. Source photos never leave disk.
"""

from __future__ import annotations

import json
from pathlib import Path

import cv2
import mediapipe as mp
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/source/aakash-clean-reference.png"
MODEL = ROOT / "tools/models/face_landmarker.task"
TEXTURE = ROOT / "assets/aakash-face.jpg"
GEOMETRY = ROOT / "assets/aakash-face.json"


def main() -> None:
    detector = mp.tasks.vision.FaceLandmarker.create_from_model_path(str(MODEL))
    result = detector.detect(mp.Image.create_from_file(str(SOURCE)))
    detector.close()
    if not result.face_landmarks:
        raise RuntimeError("No face detected in the reference portrait")
    landmarks = result.face_landmarks[0]
    image = Image.open(SOURCE).convert("RGB")
    width, height = image.size

    left, right = landmarks[234].x, landmarks[454].x
    top, bottom = landmarks[10].y, landmarks[152].y
    center_x = (left + right) / 2
    sx = 1.88 / (right - left)
    sy = 2.43 / (bottom - top)

    # Crop only the facial texture. Pixel positions remain attached to the
    # detected vertices, so the photo's specific features remain in place.
    crop = (
        max(0, round((left - .035) * width)),
        max(0, round((top - .035) * height)),
        min(width, round((right + .035) * width)),
        min(height, round((bottom + .035) * height)),
    )
    image.crop(crop).save(TEXTURE, "JPEG", quality=92, subsampling=0)
    crop_width = crop[2] - crop[0]
    crop_height = crop[3] - crop[1]

    vertices = []
    for point in landmarks:
        x = (point.x - center_x) * sx
        y = 1.34 - (point.y - top) * sy
        # MediaPipe's relative depth gives the nose, eyelids and lips shape;
        # the edge taper turns the measured frontal surface toward the ears.
        z = .76 - point.z * 2.7 - .43 * (abs(x) / .94) ** 2
        u = (point.x * width - crop[0]) / crop_width
        v = 1 - (point.y * height - crop[1]) / crop_height
        vertices.append([round(x, 6), round(y, 6), round(z, 6), round(u, 6), round(v, 6)])

    # A Delaunay mesh over the measured landmarks carries the source pixels
    # through the same triangles as the 3D surface.
    subdiv = cv2.Subdiv2D((0, 0, width, height))
    for point in landmarks:
        px = min(width - 1, max(0, point.x * width))
        py = min(height - 1, max(0, point.y * height))
        try:
            subdiv.insert((px, py))
        except cv2.error:
            pass  # Duplicate points around the irises are harmless.

    pixel_points = [(point.x * width, point.y * height) for point in landmarks]
    triangles = []
    seen = set()
    for six in subdiv.getTriangleList():
        corners = [(float(six[i]), float(six[i + 1])) for i in (0, 2, 4)]
        if any(x < 0 or x >= width or y < 0 or y >= height for x, y in corners):
            continue
        ids = [min(range(len(pixel_points)), key=lambda j: (pixel_points[j][0] - x) ** 2 + (pixel_points[j][1] - y) ** 2) for x, y in corners]
        if len(set(ids)) != 3:
            continue
        if any((pixel_points[idx][0] - corner[0]) ** 2 + (pixel_points[idx][1] - corner[1]) ** 2 > 4 for idx, corner in zip(ids, corners)):
            continue
        key = tuple(sorted(ids))
        if key in seen:
            continue
        seen.add(key)
        triangles.append(ids)

    if len(triangles) < 600:
        raise RuntimeError(f"Face mesh was incomplete: only {len(triangles)} triangles")
    GEOMETRY.write_text(json.dumps({"vertices": vertices, "triangles": triangles, "sourceDimensions": [width, height]}, separators=(",", ":")))
    print(f"Wrote {len(vertices)} vertices, {len(triangles)} triangles, {TEXTURE.stat().st_size // 1024} KiB texture")


if __name__ == "__main__":
    main()
