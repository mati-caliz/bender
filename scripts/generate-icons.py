#!/usr/bin/env python3
import sys
from pathlib import Path

from PIL import Image, ImageDraw

SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 8
BACKGROUND_TOP = (99, 102, 241)
BACKGROUND_BOTTOM = (14, 165, 233)
GLYPH_COLOR = (255, 255, 255, 255)
CORNER_RADIUS_RATIO = 0.24


def gradient_background(size: int) -> Image.Image:
    background = Image.new('RGBA', (size, size))
    pixels = background.load()
    for y in range(size):
        blend = y / max(size - 1, 1)
        color = tuple(
            round(BACKGROUND_TOP[channel] + (BACKGROUND_BOTTOM[channel] - BACKGROUND_TOP[channel]) * blend)
            for channel in range(3)
        )
        for x in range(size):
            pixels[x, y] = (*color, 255)
    return background


def rounded_mask(size: int) -> Image.Image:
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size - 1, size - 1), radius=round(size * CORNER_RADIUS_RATIO), fill=255
    )
    return mask


def draw_glyph(canvas: Image.Image, size: int) -> None:
    draw = ImageDraw.Draw(canvas)
    stroke = size * 0.085
    left = size * 0.26
    middle = size * 0.47
    top = size * 0.31
    bottom = size * 0.69
    draw.line([(left, top), (middle, size / 2), (left, bottom)], fill=GLYPH_COLOR, width=round(stroke), joint='curve')
    draw.line(
        [(size * 0.56, bottom), (size * 0.76, bottom)],
        fill=GLYPH_COLOR,
        width=round(stroke),
    )


def build_icon(size: int) -> Image.Image:
    canvas_size = size * SUPERSAMPLE
    icon = gradient_background(canvas_size)
    icon.putalpha(rounded_mask(canvas_size))
    draw_glyph(icon, canvas_size)
    return icon.resize((size, size), Image.LANCZOS)


def main() -> int:
    output_directory = Path(sys.argv[1] if len(sys.argv) > 1 else 'public/icons')
    output_directory.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        build_icon(size).save(output_directory / f'icon{size}.png')
    print(f'iconos generados en {output_directory}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
