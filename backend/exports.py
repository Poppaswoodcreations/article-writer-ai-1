import io
import re
from pathlib import Path
from typing import Callable, List, Optional, Tuple

from docx import Document
from docx.shared import Inches, Pt
from PIL import Image as PILImage
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image as RLImage, ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer

ASSETS = Path(__file__).parent / "assets"
IMG_RE = re.compile(r"!\[([^\]]*)\]\(([^)\s]+)\)")
INLINE_RE = re.compile(r"(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))")

ImageFetcher = Callable[[str], Optional[bytes]]


def parse_blocks(markdown: str) -> List[Tuple[str, object]]:
    blocks, para, items = [], [], []

    def flush():
        nonlocal para, items
        if para:
            blocks.append(("p", " ".join(para)))
            para = []
        if items:
            blocks.append(("ul", items))
            items = []

    for raw in markdown.splitlines():
        line = raw.rstrip()
        if not line.strip():
            flush()
            continue
        if re.fullmatch(r"\s*(-{3,}|\*{3,}|_{3,})\s*", line):
            flush()
            blocks.append(("hr", None))
            continue
        img = IMG_RE.fullmatch(line.strip())
        heading = re.match(r"^(#{1,6})\s+(.*)", line)
        bullet = re.match(r"^\s*(?:[-*+]|\d+[.)])\s+(.*)", line)
        if img:
            flush()
            blocks.append(("img", (img.group(1), img.group(2))))
        elif heading:
            flush()
            blocks.append((f"h{len(heading.group(1))}", heading.group(2).strip()))
        elif bullet:
            if para:
                flush()
            items.append(bullet.group(1))
        else:
            if items:
                flush()
            para.append(line.strip())
    flush()
    return blocks


def inline_runs(text: str) -> List[Tuple[str, dict]]:
    runs = []
    for part in INLINE_RE.split(text):
        if not part:
            continue
        if part.startswith("**"):
            runs.append((part[2:-2], {"bold": True}))
        elif part.startswith("*"):
            runs.append((part[1:-1], {"italic": True}))
        elif part.startswith("`"):
            runs.append((part[1:-1], {"code": True}))
        elif part.startswith("["):
            m = re.match(r"\[([^\]]+)\]\(([^)]+)\)", part)
            runs.append((m.group(1), {"link": m.group(2)}))
        else:
            runs.append((part, {}))
    return runs


def _scaled(image_bytes: bytes, max_w: float) -> Tuple[float, float]:
    with PILImage.open(io.BytesIO(image_bytes)) as im:
        w, h = im.size
    scale = min(1.0, max_w / w)
    return w * scale, h * scale


def build_docx(article: dict, fetch_image: ImageFetcher) -> bytes:
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Georgia"
    style.font.size = Pt(11)
    doc.add_heading(article["title"], level=0)

    for kind, value in parse_blocks(article["content"]):
        if kind == "hr":
            doc.add_paragraph()
            continue
        if kind.startswith("h"):
            doc.add_heading(value, level=min(int(kind[1]), 4))
        elif kind == "p":
            p = doc.add_paragraph()
            for text, fmt in inline_runs(value):
                run = p.add_run(text)
                run.bold = fmt.get("bold", False)
                run.italic = fmt.get("italic", False)
                if fmt.get("code"):
                    run.font.name = "Courier New"
        elif kind == "ul":
            for item in value:
                p = doc.add_paragraph(style="List Bullet")
                for text, fmt in inline_runs(item):
                    run = p.add_run(text)
                    run.bold = fmt.get("bold", False)
                    run.italic = fmt.get("italic", False)
        elif kind == "img":
            alt, url = value
            data = fetch_image(url)
            if data:
                doc.add_picture(io.BytesIO(data), width=Inches(6))
                if alt:
                    cap = doc.add_paragraph(alt)
                    cap.runs[0].italic = True
                    cap.runs[0].font.size = Pt(9)

    doc.add_page_break()
    doc.add_heading("SEO Metadata", level=1)
    for label, key in (("Meta Title", "meta_title"), ("Meta Description", "meta_description"), ("URL Slug", "url_slug")):
        p = doc.add_paragraph()
        p.add_run(f"{label}: ").bold = True
        p.add_run(article.get(key, ""))

    out = io.BytesIO()
    doc.save(out)
    return out.getvalue()


def _register_fonts():
    if "Serif" in pdfmetrics.getRegisteredFontNames():
        return
    pdfmetrics.registerFont(TTFont("Serif", str(ASSETS / "LiberationSerif-Regular.ttf")))
    pdfmetrics.registerFont(TTFont("Serif-Bold", str(ASSETS / "LiberationSerif-Bold.ttf")))
    pdfmetrics.registerFont(TTFont("Serif-Italic", str(ASSETS / "LiberationSerif-Italic.ttf")))
    pdfmetrics.registerFont(TTFont("Sans-Bold", str(ASSETS / "LiberationSans-Bold.ttf")))
    pdfmetrics.registerFontFamily("Serif", normal="Serif", bold="Serif-Bold", italic="Serif-Italic", boldItalic="Serif-Bold")


def _escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _inline_markup(text: str) -> str:
    parts = []
    for run, fmt in inline_runs(text):
        s = _escape(run)
        if fmt.get("bold"):
            s = f"<b>{s}</b>"
        elif fmt.get("italic"):
            s = f"<i>{s}</i>"
        elif fmt.get("code"):
            s = f"<font face='Courier'>{s}</font>"
        elif fmt.get("link"):
            s = f"<a href='{_escape(fmt['link'])}' color='#1d4ed8'>{s}</a>"
        parts.append(s)
    return "".join(parts)


def build_pdf(article: dict, fetch_image: ImageFetcher) -> bytes:
    _register_fonts()
    out = io.BytesIO()
    doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=0.9 * inch, rightMargin=0.9 * inch, topMargin=0.9 * inch, bottomMargin=0.9 * inch,
                            title=article.get("meta_title") or article["title"], author="Content Studio")
    max_w = A4[0] - 1.8 * inch
    body = ParagraphStyle("body", fontName="Serif", fontSize=11, leading=17, spaceAfter=9, alignment=TA_LEFT)
    styles = {
        "title": ParagraphStyle("title", fontName="Serif-Bold", fontSize=26, leading=32, spaceAfter=18),
        "h1": ParagraphStyle("h1", fontName="Sans-Bold", fontSize=18, leading=23, spaceBefore=14, spaceAfter=8),
        "h2": ParagraphStyle("h2", fontName="Sans-Bold", fontSize=15, leading=20, spaceBefore=12, spaceAfter=6),
        "h3": ParagraphStyle("h3", fontName="Sans-Bold", fontSize=12.5, leading=17, spaceBefore=10, spaceAfter=4),
        "caption": ParagraphStyle("caption", fontName="Serif-Italic", fontSize=9, leading=12, textColor="#666666", spaceAfter=10),
        "meta": ParagraphStyle("meta", fontName="Serif", fontSize=10, leading=14, textColor="#444444", spaceAfter=4),
    }
    story = [Paragraph(_escape(article["title"]), styles["title"])]

    for kind, value in parse_blocks(article["content"]):
        if kind == "hr":
            story.append(Spacer(1, 12))
            continue
        if kind.startswith("h"):
            story.append(Paragraph(_inline_markup(value), styles.get(kind, styles["h3"])))
        elif kind == "p":
            story.append(Paragraph(_inline_markup(value), body))
        elif kind == "ul":
            story.append(ListFlowable([ListItem(Paragraph(_inline_markup(i), body), leftIndent=12) for i in value], bulletType="bullet", start="•", leftIndent=14))
        elif kind == "img":
            alt, url = value
            data = fetch_image(url)
            if data:
                w, h = _scaled(data, max_w)
                story += [Spacer(1, 6), RLImage(io.BytesIO(data), width=w, height=h)]
                if alt:
                    story.append(Paragraph(_escape(alt), styles["caption"]))

    story += [Spacer(1, 24), Paragraph("SEO Metadata", styles["h2"])]
    for label, key in (("Meta Title", "meta_title"), ("Meta Description", "meta_description"), ("URL Slug", "url_slug")):
        story.append(Paragraph(f"<b>{label}:</b> {_escape(article.get(key, ''))}", styles["meta"]))
    doc.build(story)
    return out.getvalue()
