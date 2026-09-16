"""Backend regression tests for AI Article Writer.
Focus of iteration 2: image upload + object storage serving, existing article CRUD, export.
Skips article generation to save LLM budget unless no articles exist.
"""
import io
import os
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://article-writer-ai-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _make_png(width=2, height=2, color=(255, 0, 0)):
    """Build a tiny valid PNG in-memory."""
    def chunk(ctype, data):
        return (struct.pack(">I", len(data)) + ctype + data
                + struct.pack(">I", zlib.crc32(ctype + data) & 0xffffffff))
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw = b""
    for _ in range(height):
        raw += b"\x00" + bytes(color) * width
    idat = zlib.compress(raw)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


@pytest.fixture(scope="module")
def article_id():
    r = requests.get(f"{API}/articles", timeout=30)
    assert r.status_code == 200
    articles = r.json()
    if articles:
        return articles[0]["id"]
    # Generate one only if empty
    r = requests.post(f"{API}/articles/generate", json={
        "topic": "TEST_ Sample topic for tests",
        "keywords": "test",
        "tone": "professional",
    }, timeout=180)
    assert r.status_code == 200, r.text
    return r.json()["article_id"]


# Health
def test_root():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    assert "message" in r.json()


# CRUD read
def test_list_articles():
    r = requests.get(f"{API}/articles", timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_single(article_id):
    r = requests.get(f"{API}/articles/{article_id}", timeout=30)
    assert r.status_code == 200
    data = r.json()
    for f in ["id", "title", "content", "meta_title", "meta_description", "url_slug"]:
        assert f in data
    assert data["id"] == article_id


# Upload image - success
def test_upload_image_success_and_fetch():
    png = _make_png()
    files = {"file": ("test.png", io.BytesIO(png), "image/png")}
    r = requests.post(f"{API}/upload-image", files=files, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "url" in body and "filename" in body
    assert body["url"].startswith("/api/files/article-writer/uploads/")
    assert body["url"].endswith(".png")

    # Fetch via full URL
    full = f"{BASE_URL}{body['url']}"
    r2 = requests.get(full, timeout=30)
    assert r2.status_code == 200, full
    assert r2.headers.get("content-type", "").startswith("image/png")
    assert r2.content[:8] == b"\x89PNG\r\n\x1a\n"


# Upload image - reject non-image
def test_upload_image_invalid_type():
    files = {"file": ("test.txt", io.BytesIO(b"hello"), "text/plain")}
    r = requests.post(f"{API}/upload-image", files=files, timeout=30)
    assert r.status_code == 400


# GET /api/files/<nonexistent> => 404
def test_get_file_nonexistent():
    r = requests.get(f"{API}/files/article-writer/uploads/does-not-exist-xyz.png", timeout=30)
    assert r.status_code == 404


# Export markdown + html
def test_export_markdown(article_id):
    r = requests.get(f"{API}/articles/{article_id}/export/markdown", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["format"] == "markdown"
    assert data["content"]
    assert data["filename"].endswith(".md")


def test_export_html(article_id):
    r = requests.get(f"{API}/articles/{article_id}/export/html", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["format"] == "html"
    assert "<!DOCTYPE html>" in data["content"]


# Update persistence (Create->Update->GET)
def test_update_article_persists(article_id):
    new_meta = "TEST_ Updated meta description for regression check"
    r = requests.put(f"{API}/articles/{article_id}", json={"meta_description": new_meta}, timeout=30)
    assert r.status_code == 200
    assert r.json()["meta_description"] == new_meta
    # Re-fetch
    r2 = requests.get(f"{API}/articles/{article_id}", timeout=30)
    assert r2.status_code == 200
    assert r2.json()["meta_description"] == new_meta
