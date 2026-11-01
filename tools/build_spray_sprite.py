"""Render the spray bottle and mist into a transparent 12-frame sprite sheet."""

from pathlib import Path
from random import Random

from PIL import Image, ImageDraw, ImageFilter, ImageFont


WIDTH, HEIGHT = 700, 430
SCALE = 2
FRAMES = 12


def point(x, y):
    return round(x * SCALE), round(y * SCALE)


def box(x0, y0, x1, y1):
    return (*point(x0, y0), *point(x1, y1))


def draw_bottle(image, pressed, offset):
    d = ImageDraw.Draw(image, "RGBA")
    # A translucent teal bottle with a curved shoulder and weighted base.
    d.rounded_rectangle(box(41 + offset, 235, 153 + offset, 417), 19 * SCALE,
                        fill=(28, 106, 111, 235), outline=(15, 54, 62, 255), width=4 * SCALE)
    for x in range(47, 148):
        glow = max(0, 1 - abs(x - 68) / 60)
        d.line([point(x + offset, 257), point(x + offset, 405)],
               fill=(100, 216, 215, int(38 * glow)), width=2 * SCALE)
    d.polygon([point(55 + offset, 245), point(69 + offset, 218), point(121 + offset, 218),
               point(142 + offset, 245)], fill=(32, 115, 119, 250))
    d.rounded_rectangle(box(74 + offset, 205, 127 + offset, 235), 6 * SCALE,
                        fill=(25, 50, 57, 255), outline=(155, 174, 174, 255), width=2 * SCALE)
    # Trigger housing, chrome nozzle, and moving trigger.
    d.rounded_rectangle(box(72 + offset, 183, 178 + offset, 218), 10 * SCALE,
                        fill=(27, 35, 39, 255), outline=(167, 177, 179, 255), width=3 * SCALE)
    d.rounded_rectangle(box(159 + offset, 188, 195 + offset, 207), 5 * SCALE,
                        fill=(159, 172, 176, 255), outline=(36, 49, 52, 255), width=3 * SCALE)
    d.rounded_rectangle(box(189 + offset, 191, 204 + offset, 204), 2 * SCALE,
                        fill=(39, 48, 52, 255), outline=(195, 206, 208, 255), width=2 * SCALE)
    trigger_y = 224 if pressed else 230
    d.polygon([point(99 + offset, 211), point(132 + offset, 211), point(122 + offset, trigger_y),
               point(105 + offset, trigger_y + 9)], fill=(31, 39, 43, 255))
    d.line([point(93 + offset, 190), point(168 + offset, 190)], fill=(236, 242, 238, 100), width=2 * SCALE)
    d.rounded_rectangle(box(59 + offset, 294, 135 + offset, 351), 8 * SCALE,
                        fill=(233, 245, 238, 220), outline=(171, 202, 198, 220), width=2 * SCALE)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 25 * SCALE)
        d.text(point(75 + offset, 309), "H₂O", font=font, fill=(35, 87, 89, 240))
    except OSError:
        pass
    d.line([point(51 + offset, 405), point(141 + offset, 405)], fill=(9, 54, 58, 170), width=4 * SCALE)


def draw_mist(image, frame):
    if frame < 2 or frame > 10:
        return
    spray = Image.new("RGBA", image.size)
    d = ImageDraw.Draw(spray, "RGBA")
    rnd = Random(1800 + frame)
    reach = min(1, (frame - 1) / 6)
    for _ in range(440):
        travel = rnd.random() * reach
        x = 205 + travel * 455 + rnd.uniform(-9, 9)
        y = 197 - travel * 82 + rnd.gauss(0, 8 + travel * 48)
        radius = rnd.uniform(.45, 2.35) * (1 + travel * .3)
        alpha = round(120 * (1 - travel * .55) * min(1, (11 - frame) / 2))
        d.ellipse(box(x - radius, y - radius, x + radius, y + radius),
                  fill=(222, 248, 255, alpha))
    blurred = spray.filter(ImageFilter.GaussianBlur(5 * SCALE))
    image.alpha_composite(blurred)
    image.alpha_composite(spray)


sheet = Image.new("RGBA", (WIDTH * 4, HEIGHT * 3))
for frame in range(FRAMES):
    image = Image.new("RGBA", (WIDTH * SCALE, HEIGHT * SCALE))
    offset = -35 if frame == 0 else -15 if frame == 1 else 0
    draw_mist(image, frame)
    draw_bottle(image, frame in (2, 3, 5, 6, 8, 9), offset)
    image = image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    sheet.paste(image, ((frame % 4) * WIDTH, (frame // 4) * HEIGHT))

sheet.save(Path(__file__).resolve().parents[1] / "assets/water-spray-sprite.png", optimize=True)
