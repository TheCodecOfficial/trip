# Generates the app icons in public/ (run once: python3 scripts/make-icons.py).
from PIL import Image, ImageDraw

BG, SUN, FG = "#1b1f2a", "#e2513a", "#f4f2ee"
# Shapes on a 512 grid: sun + torii.
SUN_C, SUN_R = (256, 222), 128
RECTS = [(112, 292, 400, 320), (150, 350, 362, 368), (176, 300, 204, 444), (308, 300, 336, 444), (242, 320, 270, 350)]


def draw(size, radius, scale=1.0):
    img = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = size * 4 / 512
    d.rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=radius * k, fill=BG)
    off = 256 * (1 - scale)
    t = lambda v: (off + v * scale) * k
    cx, cy = SUN_C
    d.ellipse((t(cx - SUN_R), t(cy - SUN_R), t(cx + SUN_R), t(cy + SUN_R)), fill=SUN)
    for x0, y0, x1, y1 in RECTS:
        d.rectangle((t(x0), t(y0), t(x1), t(y1)), fill=FG)
    return img.resize((size, size), Image.LANCZOS)


draw(192, 96).save("public/icon-192.png")
draw(512, 96).save("public/icon-512.png")
draw(512, 0, scale=0.78).save("public/icon-maskable-512.png")

rects = "".join(f'<rect x="{a}" y="{b}" width="{c - a}" height="{e - b}"/>' for a, b, c, e in RECTS)
open("public/icon.svg", "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="{BG}"/>'
    f'<circle cx="{SUN_C[0]}" cy="{SUN_C[1]}" r="{SUN_R}" fill="{SUN}"/><g fill="{FG}">{rects}</g></svg>\n'
)
