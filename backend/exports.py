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


EMOJI_RE = re.compile("[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F900-\U0001F9FF\uFE0F\u200d]")


def _strip_emoji(text: str) -> str:
    return re.sub(r"  +", " ", EMOJI_RE.sub("", text)).strip()


def _escape(text: str) -> str:
    return _strip_emoji(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


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


PLATFORM_LABELS = {"facebook": "Facebook", "instagram": "Instagram", "linkedin": "LinkedIn", "twitter": "X / Twitter", "tiktok": "TikTok"}
PLATFORM_COLORS = {"facebook": "#1877F2", "instagram": "#E1306C", "linkedin": "#0A66C2", "twitter": "#111111", "tiktok": "#FE2C55"}


def _deck_styles(accent: str) -> dict:
    return {
        "cover": ParagraphStyle("cover", fontName="Sans-Bold", fontSize=34, leading=40, textColor="#111111", spaceAfter=14),
        "sub": ParagraphStyle("sub", fontName="Serif", fontSize=14, leading=20, textColor="#444444", spaceAfter=6),
        "kicker": ParagraphStyle("kicker", fontName="Sans-Bold", fontSize=10, leading=13, textColor=accent, spaceAfter=4),
        "h": ParagraphStyle("h", fontName="Sans-Bold", fontSize=22, leading=27, textColor="#111111", spaceAfter=10),
        "body": ParagraphStyle("body", fontName="Serif", fontSize=11.5, leading=17, textColor="#222222", spaceAfter=8),
        "tags": ParagraphStyle("tags", fontName="Serif-Italic", fontSize=10, leading=14, textColor="#555555"),
        "small": ParagraphStyle("small", fontName="Serif", fontSize=9, leading=12, textColor="#777777"),
    }


def _fmt_when(iso: Optional[str]) -> str:
    if not iso:
        return "Not scheduled"
    from datetime import datetime
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%a %b %d, %Y · %H:%M UTC")


def build_campaign_deck(campaign: dict, brand: dict, fetch_image: ImageFetcher) -> bytes:
    from reportlab.lib.pagesizes import landscape
    from reportlab.platypus import PageBreak, Table, TableStyle
    from reportlab.lib import colors

    _register_fonts()
    accent = brand.get("accent_color") or "#F59E0B"
    st = _deck_styles(accent)
    page = landscape(A4)
    out = io.BytesIO()
    doc = SimpleDocTemplate(out, pagesize=page, leftMargin=0.8 * inch, rightMargin=0.8 * inch, topMargin=0.7 * inch, bottomMargin=0.7 * inch,
                            title=f"{campaign['name']} — Campaign Deck", author=brand.get("name") or "Content Studio")
    content_w = page[0] - 1.6 * inch
    footer_text = " · ".join(filter(None, [brand.get("name"), brand.get("handle"), campaign["name"]]))

    def on_page(canvas, _doc):
        canvas.saveState()
        canvas.setFillColor(colors.HexColor(accent))
        canvas.rect(0, page[1] - 8, page[0], 8, stroke=0, fill=1)
        canvas.setFont("Serif", 8)
        canvas.setFillColor(colors.HexColor("#888888"))
        canvas.drawString(0.8 * inch, 0.4 * inch, footer_text)
        canvas.drawRightString(page[0] - 0.8 * inch, 0.4 * inch, f"Page {_doc.page}")
        canvas.restoreState()

    story = []
    logo = fetch_image(f"/api/files/{brand['logo_path']}") if brand.get("logo_path") else None
    if logo:
        lw, lh = _scaled(logo, 1.6 * inch)
        story += [RLImage(io.BytesIO(logo), width=lw, height=lh, hAlign="LEFT"), Spacer(1, 24)]
    else:
        story.append(Spacer(1, 60))
    story += [Paragraph("CAMPAIGN DECK · FOR APPROVAL", st["kicker"]), Paragraph(_escape(campaign["name"]), st["cover"]),
              Paragraph(f"<b>Topic:</b> {_escape(campaign['topic'])}", st["sub"])]
    if campaign.get("goal"):
        story.append(Paragraph(f"<b>Goal:</b> {_escape(campaign['goal'])}", st["sub"]))
    scheduled = [p for p in campaign["posts"] if p.get("scheduled_at")]
    story.append(Paragraph(f"{len(campaign['posts'])} posts · {len(scheduled)} scheduled" + (" · includes email" if campaign.get("email_copy") else ""), st["small"]))
    story.append(PageBreak())

    for post in campaign["posts"]:
        label = PLATFORM_LABELS.get(post["platform"], post["platform"].title())
        color = PLATFORM_COLORS.get(post["platform"], accent)
        left = [Paragraph(f"<font color='{color}'>■</font> {label.upper()}", st["kicker"]), Paragraph(_escape(label + " post"), st["h"]),
                Paragraph(_fmt_when(post.get("scheduled_at")), st["small"]), Spacer(1, 10)]
        for para in post["content"].split("\n"):
            left.append(Paragraph(_escape(para) or "&nbsp;", st["body"]))
        if post.get("hashtags"):
            left.append(Paragraph(_escape(post["hashtags"]), st["tags"]))
        graphic = fetch_image(f"/api/files/{post['graphic_path']}") if post.get("graphic_path") else None
        col_w = content_w * 0.46
        if graphic:
            gw, gh = _scaled(graphic, col_w)
            max_h = page[1] - 2.2 * inch
            if gh > max_h:
                gw, gh = gw * max_h / gh, max_h
            right = [RLImage(io.BytesIO(graphic), width=gw, height=gh)]
        else:
            right = [Paragraph("No graphic created yet", st["small"])]
        table = Table([[left, right]], colWidths=[content_w - col_w - 12, col_w], hAlign="LEFT")
        table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (0, 0), 12)]))
        story += [table, PageBreak()]

    if campaign.get("email_copy"):
        story += [Paragraph("EMAIL", st["kicker"]), Paragraph("Email blast", st["h"]), Spacer(1, 8)]
        for para in campaign["email_copy"].split("\n"):
            story.append(Paragraph(_escape(para) or "&nbsp;", st["body"]))
        story.append(PageBreak())

    story += [Paragraph("SCHEDULE", st["kicker"]), Paragraph("Publishing schedule", st["h"]), Spacer(1, 8)]
    rows = [["When", "Platform", "Post"]]
    for p in sorted(campaign["posts"], key=lambda x: x.get("scheduled_at") or "9999"):
        rows.append([Paragraph(_fmt_when(p.get("scheduled_at")), st["body"]), Paragraph(PLATFORM_LABELS.get(p["platform"], p["platform"]), st["body"]),
                     Paragraph(_escape(p["content"][:140] + ("…" if len(p["content"]) > 140 else "")), st["body"])])
    sched = Table(rows, colWidths=[content_w * 0.26, content_w * 0.16, content_w * 0.58], hAlign="LEFT", repeatRows=1)
    sched.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, 0), "Sans-Bold"), ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#555555")),
                               ("LINEBELOW", (0, 0), (-1, 0), 0.8, colors.HexColor(accent)), ("LINEBELOW", (0, 1), (-1, -1), 0.3, colors.HexColor("#DDDDDD")),
                               ("VALIGN", (0, 0), (-1, -1), "TOP"), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    story.append(sched)
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return out.getvalue()
