import base64
import io
import os
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFont
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

FONT_PATH = Path(__file__).parent / "assets" / "LiberationSans-Bold.ttf"
SIZES = {
    "facebook": (1200, 630),
    "instagram": (1080, 1080),
    "linkedin": (1200, 627),
    "twitter": (1600, 900),
    "tiktok": (1080, 1920),
}
BRAND = {
    "facebook": (24, 119, 242),
    "instagram": (225, 48, 108),
    "linkedin": (10, 102, 194),
    "twitter": (0, 0, 0),
    "tiktok": (254, 44, 85),
}


def _cover(img: Image.Image, size: tuple) -> Image.Image:
    w, h = size
    scale = max(w / img.width, h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    left, top = (resized.width - w) // 2, (resized.height - h) // 2
    return resized.crop((left, top, left + w, top + h))


def _wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list:
    words, lines, line = text.split(), [], ""
    for word in words:
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines


def _fit_font(draw, text, max_width, max_height, start_size):
    size = start_size
    while size > 24:
        font = ImageFont.truetype(str(FONT_PATH), size)
        lines = _wrap(draw, text, font, max_width)
        line_h = int(size * 1.2)
        if len(lines) * line_h <= max_height and len(lines) <= 5:
            return font, lines, line_h
        size -= 4
    font = ImageFont.truetype(str(FONT_PATH), size)
    return font, _wrap(draw, text, font, max_width)[:5], int(size * 1.2)


def _hex(color: Optional[str], fallback: tuple) -> tuple:
    if not color:
        return fallback
    c = color.lstrip("#")
    if len(c) != 6:
        return fallback
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


def _place_logo(base: Image.Image, logo_bytes: bytes, corner: str, margin: int) -> None:
    logo = Image.open(io.BytesIO(logo_bytes)).convert("RGBA")
    target_w = int(base.width * 0.16)
    logo = logo.resize((target_w, max(1, round(logo.height * target_w / logo.width))), Image.LANCZOS)
    x = margin if "left" in corner else base.width - margin - logo.width
    y = margin if "top" in corner else base.height - margin - logo.height
    base.paste(logo, (x, y), logo)


def render_graphic(image_bytes: bytes, platform: str, headline: str, handle: Optional[str] = None, brand: Optional[dict] = None) -> bytes:
    brand = brand or {}
    size = SIZES.get(platform, SIZES["facebook"])
    w, h = size
    base = _cover(Image.open(io.BytesIO(image_bytes)).convert("RGB"), size)

    # Bottom gradient for legibility
    gradient = Image.new("L", (1, h))
    for y in range(h):
        t = max(0.0, (y - h * 0.35) / (h * 0.65))
        gradient.putpixel((0, y), int(230 * (t ** 1.4)))
    shade = Image.new("RGB", size, (8, 8, 12))
    base = Image.composite(shade, base, gradient.resize(size))

    draw = ImageDraw.Draw(base)
    margin = int(w * 0.07)
    max_text_w = w - 2 * margin
    max_text_h = int(h * (0.42 if platform == "tiktok" else 0.5))
    start = int(w * (0.075 if platform == "tiktok" else 0.065))
    font, lines, line_h = _fit_font(draw, headline.strip(), max_text_w, max_text_h, start)

    bottom_pad = int(h * (0.16 if platform == "tiktok" else 0.12))
    y = h - bottom_pad - len(lines) * line_h
    accent = _hex(brand.get("accent_color"), BRAND.get(platform, (245, 158, 11)))
    draw.rectangle([margin, y - int(line_h * 0.6), margin + int(w * 0.09), y - int(line_h * 0.6) + max(6, h // 160)], fill=accent)
    for line in lines:
        draw.text((margin + 3, y + 3), line, font=font, fill=(0, 0, 0, 160))
        draw.text((margin, y), line, font=font, fill=(255, 255, 255))
        y += line_h

    handle = handle or brand.get("handle")
    if handle:
        small = ImageFont.truetype(str(FONT_PATH), max(20, w // 45))
        draw.text((margin, h - bottom_pad + int(line_h * 0.35)), handle, font=small, fill=_hex(brand.get("primary_color"), (230, 230, 230)))

    if brand.get("logo_bytes"):
        _place_logo(base, brand["logo_bytes"], brand.get("logo_corner") or "top-right", margin)

    out = io.BytesIO()
    base.save(out, format="PNG", optimize=True)
    return out.getvalue()


async def ai_enhance(image_bytes: bytes, platform: str, brief: str) -> bytes:
    w, h = SIZES.get(platform, SIZES["facebook"])
    orientation = "tall vertical 9:16" if platform == "tiktok" else ("square 1:1" if platform == "instagram" else "wide horizontal 16:9")
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"gfx-{platform}-{id(image_bytes)}", system_message="You are a professional social media graphic designer.")
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    prompt = (f"Recreate this image as a polished, eye-catching {platform} marketing visual in a {orientation} composition. "
              f"Keep the main subject recognizable, improve lighting and colors, add a tasteful branded backdrop. "
              f"Leave the lower third clean and uncluttered for a text overlay. Do NOT add any text or letters. Campaign context: {brief}")
    _, images = await chat.send_message_multimodal_response(UserMessage(text=prompt, file_contents=[ImageContent(base64.b64encode(image_bytes).decode())]))
    if not images:
        raise RuntimeError("AI did not return an image")
    return base64.b64decode(images[0]["data"])
