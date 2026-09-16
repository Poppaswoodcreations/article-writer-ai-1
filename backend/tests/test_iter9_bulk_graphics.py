"""Iteration 9: Bulk graphics generation for campaign."""
import io
import os
import pytest
import requests
from PIL import Image

from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
CAMPAIGN_ID = "12e4723b-5378-46cd-9d5c-42b5d63b77c3"


def _make_png(size=(600, 400), color=(30, 120, 200)):
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, "PNG")
    buf.seek(0)
    return buf


@pytest.fixture(scope="module")
def uploaded_image():
    files = {"file": ("t.png", _make_png(), "image/png")}
    r = requests.post(f"{BASE_URL}/api/upload-image", files=files)
    assert r.status_code == 200, r.text
    data = r.json()
    # url like /api/files/<path>
    path = data["url"].replace("/api/files/", "")
    return path


def _has_accent(png_bytes, rgb=(225, 29, 72), tol=15):
    img = Image.open(io.BytesIO(png_bytes)).convert("RGB")
    # sample pixels
    pixels = img.getdata()
    for r, g, b in list(pixels)[::113]:
        if abs(r - rgb[0]) <= tol and abs(g - rgb[1]) <= tol and abs(b - rgb[2]) <= tol:
            return True
    return False


class TestBulkGraphics:
    def test_campaign_exists(self):
        r = requests.get(f"{BASE_URL}/api/campaigns/{CAMPAIGN_ID}")
        assert r.status_code == 200
        c = r.json()
        platforms = {p["platform"] for p in c["posts"]}
        assert {"facebook", "instagram"}.issubset(platforms)

    def test_unknown_campaign_404(self, uploaded_image):
        r = requests.post(
            f"{BASE_URL}/api/campaigns/nonexistent-id-xyz/graphics/all",
            json={"image_path": uploaded_image},
        )
        assert r.status_code == 404

    def test_unknown_image_404(self):
        r = requests.post(
            f"{BASE_URL}/api/campaigns/{CAMPAIGN_ID}/graphics/all",
            json={"image_path": "does/not/exist.png"},
        )
        assert r.status_code == 404

    def test_bulk_create_overwrite(self, uploaded_image):
        r = requests.post(
            f"{BASE_URL}/api/campaigns/{CAMPAIGN_ID}/graphics/all",
            json={"image_path": uploaded_image, "ai_enhance": False, "use_brand": True, "overwrite": True},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("created"), list)
        assert isinstance(data.get("failed"), list)
        assert data["failed"] == []
        assert "facebook" in data["created"] and "instagram" in data["created"]
        assert data.get("posts")
        # each post has graphic_path
        by_platform = {p["platform"]: p for p in data["posts"]}
        assert by_platform["facebook"].get("graphic_path")
        assert by_platform["instagram"].get("graphic_path")
        # fetch and verify dims + accent
        expected = {"facebook": (1200, 630), "instagram": (1080, 1080)}
        for plat, size in expected.items():
            path = by_platform[plat]["graphic_path"]
            g = requests.get(f"{BASE_URL}/api/files/{path}")
            assert g.status_code == 200
            assert g.headers.get("content-type", "").startswith("image/")
            img = Image.open(io.BytesIO(g.content))
            assert img.size == size, f"{plat} size {img.size} != {size}"
            assert _has_accent(g.content), f"Brand accent color not found in {plat} graphic"
        # save paths for next test
        TestBulkGraphics.prev_paths = {p: by_platform[p]["graphic_path"] for p in ["facebook", "instagram"]}

    def test_bulk_no_overwrite_keeps_existing(self, uploaded_image):
        r = requests.post(
            f"{BASE_URL}/api/campaigns/{CAMPAIGN_ID}/graphics/all",
            json={"image_path": uploaded_image, "overwrite": False},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["created"] == []
        by_platform = {p["platform"]: p for p in data["posts"]}
        for plat, prev in TestBulkGraphics.prev_paths.items():
            assert by_platform[plat]["graphic_path"] == prev


class TestSinglePostRegression:
    def test_single_graphic_ok(self, uploaded_image):
        r = requests.post(
            f"{BASE_URL}/api/campaigns/{CAMPAIGN_ID}/posts/facebook/graphic",
            json={"image_path": uploaded_image, "headline": "Hello", "ai_enhance": False, "use_brand": True},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "url" in data and "path" in data
        g = requests.get(f"{BASE_URL}{data['url']}")
        assert g.status_code == 200
        img = Image.open(io.BytesIO(g.content))
        assert img.size == (1200, 630)

    def test_single_unknown_platform_404(self, uploaded_image):
        r = requests.post(
            f"{BASE_URL}/api/campaigns/{CAMPAIGN_ID}/posts/tiktok/graphic",
            json={"image_path": uploaded_image, "headline": "Hello"},
        )
        assert r.status_code == 404
