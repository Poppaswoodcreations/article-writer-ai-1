"""Iteration 6 tests: graphics, regenerate, schedule CSV/ICS.
Reuses campaign 12e4723b-5378-46cd-9d5c-42b5d63b77c3 (facebook+instagram).
Generates one new campaign with facebook+tiktok for tiktok graphic test.
Total LLM calls (backend): 1 campaign gen + 1 regenerate + 1 AI-enhance = 3
"""
import os
import io
import time
import requests
import pytest
from PIL import Image

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

EXISTING = "12e4723b-5378-46cd-9d5c-42b5d63b77c3"


def _make_png(w=800, h=800, color=(120, 60, 200)):
    im = Image.new("RGB", (w, h), color)
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture(scope="module")
def uploaded_image_path():
    png = _make_png()
    r = requests.post(f"{API}/upload-image", files={"file": ("t.png", png, "image/png")}, timeout=30)
    assert r.status_code == 200, r.text
    url = r.json()["url"]  # /api/files/article-writer/uploads/xxx.png
    return url.replace("/api/files/", "")


@pytest.fixture(scope="module")
def tiktok_campaign_id():
    payload = {"topic": "Autumn coffee blends launch", "goal": "drive sign-ups",
               "platforms": ["facebook", "tiktok"], "include_email": False}
    r = requests.post(f"{API}/campaigns/generate", json=payload, timeout=180)
    assert r.status_code == 200, r.text
    return r.json()["campaign_id"]


# --- graphic creation ---

def test_graphic_facebook_no_ai(uploaded_image_path):
    body = {"image_path": uploaded_image_path, "headline": "Summer glow deals", "handle": "@glowbrand", "ai_enhance": False}
    r = requests.post(f"{API}/campaigns/{EXISTING}/posts/facebook/graphic", json=body, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["url"].startswith("/api/files/article-writer/graphics/")
    # GET the image
    img_url = f"{BASE_URL}{data['url']}"
    img_resp = requests.get(img_url, timeout=30)
    assert img_resp.status_code == 200
    assert img_resp.headers["content-type"].startswith("image/png")
    im = Image.open(io.BytesIO(img_resp.content))
    assert im.size == (1200, 630), f"expected facebook 1200x630, got {im.size}"
    # Campaign post updated
    camp = requests.get(f"{API}/campaigns/{EXISTING}", timeout=30).json()
    fb = next(p for p in camp["posts"] if p["platform"] == "facebook")
    assert fb["graphic_path"] == data["path"]


def test_graphic_tiktok_no_ai(uploaded_image_path, tiktok_campaign_id):
    body = {"image_path": uploaded_image_path, "headline": "New autumn blends dropping today", "ai_enhance": False}
    r = requests.post(f"{API}/campaigns/{tiktok_campaign_id}/posts/tiktok/graphic", json=body, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    img_resp = requests.get(f"{BASE_URL}{data['url']}", timeout=30)
    assert img_resp.status_code == 200
    im = Image.open(io.BytesIO(img_resp.content))
    assert im.size == (1080, 1920), f"expected tiktok 1080x1920, got {im.size}"


def test_graphic_unknown_image_path_404():
    body = {"image_path": "article-writer/uploads/nonexistent-xyz.png", "headline": "hi", "ai_enhance": False}
    r = requests.post(f"{API}/campaigns/{EXISTING}/posts/facebook/graphic", json=body, timeout=30)
    assert r.status_code == 404


def test_graphic_unknown_platform_404(uploaded_image_path):
    body = {"image_path": uploaded_image_path, "headline": "hi", "ai_enhance": False}
    r = requests.post(f"{API}/campaigns/{EXISTING}/posts/mastodon/graphic", json=body, timeout=30)
    assert r.status_code == 404


def test_graphic_unknown_campaign_404(uploaded_image_path):
    body = {"image_path": uploaded_image_path, "headline": "hi", "ai_enhance": False}
    r = requests.post(f"{API}/campaigns/does-not-exist/posts/facebook/graphic", json=body, timeout=30)
    assert r.status_code == 404


# --- regenerate ---

def test_regenerate_facebook_llm():
    before = requests.get(f"{API}/campaigns/{EXISTING}", timeout=30).json()
    fb_before = next(p for p in before["posts"] if p["platform"] == "facebook")["content"]

    r = requests.post(f"{API}/campaigns/{EXISTING}/posts/facebook/regenerate",
                      json={"instruction": "shorter and funnier, under 40 words"}, timeout=180)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["platform"] == "facebook"
    assert data["content"]
    assert data["content"] != fb_before, "regenerated content matches original"

    after = requests.get(f"{API}/campaigns/{EXISTING}", timeout=30).json()
    fb_after = next(p for p in after["posts"] if p["platform"] == "facebook")["content"]
    assert fb_after == data["content"], "regenerated content not persisted"


# --- schedule CSV/ICS ---

def test_schedule_persist_and_csv_ics():
    camp = requests.get(f"{API}/campaigns/{EXISTING}", timeout=30).json()
    posts = camp["posts"]
    # ensure facebook has scheduled_at and instagram gets one
    for p in posts:
        if p["platform"] == "facebook":
            p["scheduled_at"] = "2026-07-01T09:00:00Z"
        elif p["platform"] == "instagram":
            p["scheduled_at"] = "2026-07-02T15:30:00Z"
    r = requests.put(f"{API}/campaigns/{EXISTING}",
                     json={"name": camp["name"], "posts": posts, "email_copy": camp.get("email_copy", "")}, timeout=30)
    assert r.status_code == 200, r.text

    # verify persisted
    camp2 = requests.get(f"{API}/campaigns/{EXISTING}", timeout=30).json()
    scheds = {p["platform"]: p.get("scheduled_at") for p in camp2["posts"]}
    assert scheds["facebook"] == "2026-07-01T09:00:00Z"
    assert scheds["instagram"] == "2026-07-02T15:30:00Z"

    # CSV
    r = requests.get(f"{API}/campaigns/{EXISTING}/schedule/csv", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["format"] == "csv"
    assert d["filename"].endswith(".csv")
    import csv as _csv
    reader = list(_csv.reader(io.StringIO(d["content"])))
    assert reader[0] == ["Campaign", "Platform", "Scheduled (UTC)", "Post", "Hashtags"]
    # 2 scheduled rows
    assert len(reader) == 3, f"expected 3 rows (header+2), got: {len(reader)}"
    plats = {row[1]: row[2] for row in reader[1:]}
    assert plats["facebook"] == "2026-07-01T09:00:00Z"
    assert plats["instagram"] == "2026-07-02T15:30:00Z"

    # ICS
    r = requests.get(f"{API}/campaigns/{EXISTING}/schedule/ics", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["filename"].endswith(".ics")
    ics = d["content"]
    assert "BEGIN:VCALENDAR" in ics and "END:VCALENDAR" in ics
    assert ics.count("BEGIN:VEVENT") == 2
    assert "DTSTART:20260701T090000Z" in ics
    assert "DTSTART:20260702T153000Z" in ics


def test_schedule_bad_format_400():
    r = requests.get(f"{API}/campaigns/{EXISTING}/schedule/bad", timeout=30)
    assert r.status_code == 400


# --- AI enhance (LLM) ---

def test_graphic_instagram_ai_enhance(uploaded_image_path):
    body = {"image_path": uploaded_image_path, "headline": "Glow with candles", "ai_enhance": True}
    r = requests.post(f"{API}/campaigns/{EXISTING}/posts/instagram/graphic", json=body, timeout=180)
    if r.status_code == 502:
        pytest.fail(f"AI enhance returned 502: {r.text}")
    assert r.status_code == 200, r.text
    data = r.json()
    img_resp = requests.get(f"{BASE_URL}{data['url']}", timeout=30)
    assert img_resp.status_code == 200
    im = Image.open(io.BytesIO(img_resp.content))
    assert im.size == (1080, 1080), f"expected instagram 1080x1080, got {im.size}"
