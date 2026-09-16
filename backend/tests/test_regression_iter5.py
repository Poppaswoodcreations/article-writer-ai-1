"""Iteration 5 regression tests after refactor.
Includes 1 campaign generation + parser refactor check on existing article.
"""
import os
import time
import io
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


def test_parser_refactor_no_markers_in_existing_articles():
    """Parser refactor: article.content must NOT contain literal 'META_TITLE:' or 'URL_SLUG:' markers."""
    r = requests.get(f"{API}/articles", timeout=30)
    assert r.status_code == 200
    for a in r.json():
        full = requests.get(f"{API}/articles/{a['id']}", timeout=30).json()
        content = full.get("content", "")
        assert "META_TITLE:" not in content, f"article {a['id']} content contains META_TITLE marker"
        assert "URL_SLUG:" not in content, f"article {a['id']} content contains URL_SLUG marker"
        assert "META_DESCRIPTION:" not in content
        for f in ("title", "meta_title", "meta_description", "url_slug"):
            assert full.get(f), f"article {a['id']} field {f} empty"


def test_article_export_bad_format_400():
    r = requests.get(f"{API}/articles", timeout=30)
    aid = r.json()[0]["id"]
    r = requests.get(f"{API}/articles/{aid}/export/pdf", timeout=30)
    assert r.status_code == 400


def test_campaign_export_bad_format_on_real_campaign_400():
    r = requests.get(f"{API}/campaigns", timeout=30).json()
    if not r:
        pytest.skip("no campaigns yet")
    r2 = requests.get(f"{API}/campaigns/{r[0]['id']}/export/pdf", timeout=30)
    assert r2.status_code == 400


def test_campaign_generation_full_flow():
    """LLM: generate campaign, verify posts + email_copy + exports."""
    payload = {
        "topic": "Summer sale on handmade candles",
        "goal": "Shop now",
        "platforms": ["facebook", "instagram"],
        "include_email": True,
    }
    r = requests.post(f"{API}/campaigns/generate", json=payload, timeout=180)
    assert r.status_code == 200, r.text
    cid = r.json()["campaign_id"]

    # GET
    r = requests.get(f"{API}/campaigns/{cid}", timeout=30)
    assert r.status_code == 200
    data = r.json()
    posts = data["posts"]
    platforms_in_posts = {p["platform"] for p in posts}
    assert "facebook" in platforms_in_posts
    assert "instagram" in platforms_in_posts
    for p in posts:
        assert p.get("content"), f"post {p['platform']} missing content"
        assert p.get("hashtags"), f"post {p['platform']} missing hashtags"
    assert data.get("email_copy"), "email_copy empty"

    # Exports
    for fmt, ext in [("txt", ".txt"), ("markdown", ".md"), ("html", ".html")]:
        r = requests.get(f"{API}/campaigns/{cid}/export/{fmt}", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["filename"].endswith(ext)
        assert d["content"]
    # Save cid for downstream frontend testing
    with open("/tmp/iter5_campaign_id.txt", "w") as f:
        f.write(cid)
