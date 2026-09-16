"""Iteration 7 tests: Brand kit, article DOCX/PDF download, schedule feed, graphic w/ use_brand."""
import io
import os
import re
import zipfile
import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://article-writer-ai-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ARTICLE_WITH_IMAGE_ID = "aa74874f-d686-459b-8bcd-0e36dc8fe3e2"
CAMPAIGN_ID = "12e4723b-5378-46cd-9d5c-42b5d63b77c3"


@pytest.fixture(scope="module")
def logo_path():
    """Upload a small transparent-ish PNG as brand logo."""
    img = Image.new("RGBA", (128, 128), (255, 0, 0, 255))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    r = requests.post(f"{API}/upload-image", files={"file": ("logo.png", buf, "image/png")}, timeout=30)
    assert r.status_code == 200
    url = r.json()["url"]
    return url.split("/api/files/", 1)[1]


@pytest.fixture(scope="module")
def uploaded_image_path():
    img = Image.new("RGB", (800, 800), (100, 200, 100))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    r = requests.post(f"{API}/upload-image", files={"file": ("bg.png", buf, "image/png")}, timeout=30)
    assert r.status_code == 200
    return r.json()["url"].split("/api/files/", 1)[1]


# ==================== BRAND ENDPOINTS ====================
class TestBrand:
    def test_get_brand_returns_current_or_defaults(self):
        r = requests.get(f"{API}/brand", timeout=30)
        assert r.status_code == 200
        b = r.json()
        for k in ("name", "handle", "primary_color", "accent_color", "logo_corner"):
            assert k in b

    def test_put_brand_saves_and_returns(self, logo_path):
        payload = {
            "name": "Candle Co",
            "handle": "@candleco",
            "primary_color": "#FDE68A",
            "accent_color": "#E11D48",
            "logo_path": logo_path,
            "logo_corner": "top-right",
        }
        r = requests.put(f"{API}/brand", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["accent_color"] == "#E11D48"
        assert b["logo_path"] == logo_path
        assert b["updated_at"]
        # persistence
        g = requests.get(f"{API}/brand", timeout=30).json()
        assert g["accent_color"] == "#E11D48"
        assert g["logo_path"] == logo_path

    def test_put_brand_invalid_accent(self):
        r = requests.put(f"{API}/brand", json={
            "name": "x", "handle": "@x",
            "primary_color": "#FFFFFF", "accent_color": "red", "logo_corner": "top-right"
        }, timeout=30)
        assert r.status_code == 400

    def test_put_brand_invalid_corner(self):
        r = requests.put(f"{API}/brand", json={
            "name": "x", "handle": "@x",
            "primary_color": "#FFFFFF", "accent_color": "#E11D48", "logo_corner": "middle"
        }, timeout=30)
        assert r.status_code == 400

    def test_put_brand_nonexistent_logo(self):
        r = requests.put(f"{API}/brand", json={
            "name": "x", "handle": "@x",
            "primary_color": "#FFFFFF", "accent_color": "#E11D48",
            "logo_corner": "top-right", "logo_path": "article-writer/uploads/does-not-exist.png"
        }, timeout=30)
        assert r.status_code == 404


# ==================== GRAPHIC + BRAND ====================
class TestGraphicBrand:
    def _post_content(self, platform):
        c = requests.get(f"{API}/campaigns/{CAMPAIGN_ID}", timeout=30).json()
        for p in c["posts"]:
            if p["platform"] == platform:
                return p["content"][:60]
        pytest.skip(f"No {platform} post")

    def test_graphic_use_brand_true_accent_present(self, uploaded_image_path):
        headline = self._post_content("facebook")
        r = requests.post(
            f"{API}/campaigns/{CAMPAIGN_ID}/posts/facebook/graphic",
            json={"image_path": uploaded_image_path, "headline": headline, "use_brand": True},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        path = r.json()["path"]
        img_bytes = requests.get(f"{API}/files/{path}", timeout=30).content
        im = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        # accent = #E11D48 -> (225,29,72)
        target = (225, 29, 72)
        pixels = im.getdata()
        found = any(abs(p[0]-target[0])<=5 and abs(p[1]-target[1])<=5 and abs(p[2]-target[2])<=5 for p in pixels)
        assert found, "Brand accent color not found in graphic"

    def test_graphic_use_brand_false_no_accent(self, uploaded_image_path):
        headline = self._post_content("facebook")
        r = requests.post(
            f"{API}/campaigns/{CAMPAIGN_ID}/posts/facebook/graphic",
            json={"image_path": uploaded_image_path, "headline": headline, "use_brand": False},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        path = r.json()["path"]
        img_bytes = requests.get(f"{API}/files/{path}", timeout=30).content
        im = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        # brand accent #E11D48 should NOT appear; facebook default (24,119,242) should
        target = (225, 29, 72)
        pixels = list(im.getdata())
        brand_present = any(abs(p[0]-target[0])<=5 and abs(p[1]-target[1])<=5 and abs(p[2]-target[2])<=5 for p in pixels)
        fb = (24, 119, 242)
        fb_present = any(abs(p[0]-fb[0])<=5 and abs(p[1]-fb[1])<=5 and abs(p[2]-fb[2])<=5 for p in pixels)
        assert not brand_present, "Brand accent leaked when use_brand=False"
        assert fb_present, "Facebook default color missing"


# ==================== ARTICLE DOWNLOAD ====================
class TestArticleDownload:
    def test_pdf_download(self):
        r = requests.get(f"{API}/articles/{ARTICLE_WITH_IMAGE_ID}/download/pdf", timeout=90)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and ".pdf" in cd
        assert r.content[:4] == b"%PDF"

    def test_docx_download(self):
        r = requests.get(f"{API}/articles/{ARTICLE_WITH_IMAGE_ID}/download/docx", timeout=90)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "wordprocessingml" in ct
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and ".docx" in cd
        assert r.content[:2] == b"PK"
        # validate zip and inline image
        from docx import Document
        doc = Document(io.BytesIO(r.content))
        headings = [p for p in doc.paragraphs if p.style.name.lower().startswith("heading")]
        assert len(headings) >= 1
        # inline pictures - count blip elements
        zf = zipfile.ZipFile(io.BytesIO(r.content))
        media = [n for n in zf.namelist() if n.startswith("word/media/")]
        assert len(media) >= 1, "Expected at least one inline image"

    def test_download_unknown_format(self):
        r = requests.get(f"{API}/articles/{ARTICLE_WITH_IMAGE_ID}/download/xlsx", timeout=30)
        assert r.status_code == 400

    def test_download_unknown_article(self):
        r = requests.get(f"{API}/articles/unknown-id-xyz/download/pdf", timeout=30)
        assert r.status_code == 404


# ==================== SCHEDULE FEED ====================
class TestScheduleFeed:
    def test_schedule_feed_shape(self):
        r = requests.get(f"{API}/schedule", timeout=30)
        assert r.status_code == 200
        events = r.json()
        assert isinstance(events, list)
        assert len(events) >= 1
        keys = {"campaign_id", "campaign_name", "platform", "scheduled_at", "excerpt", "graphic_path"}
        for e in events:
            assert keys.issubset(set(e.keys()))
        # sorted asc
        dates = [e["scheduled_at"] for e in events]
        assert dates == sorted(dates)
