"""Backend tests for social media campaign endpoints (new feature).
Reuses existing campaign id fc7229ca-ddd5-4410-86ad-e61684c62ff7 to avoid LLM cost.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://article-writer-ai-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

EXISTING_CAMPAIGN_ID = "fc7229ca-ddd5-4410-86ad-e61684c62ff7"


@pytest.fixture(scope="module")
def campaign_id():
    r = requests.get(f"{API}/campaigns/{EXISTING_CAMPAIGN_ID}", timeout=30)
    if r.status_code == 200:
        return EXISTING_CAMPAIGN_ID
    # Fallback: any existing campaign
    r = requests.get(f"{API}/campaigns", timeout=30)
    assert r.status_code == 200
    lst = r.json()
    if lst:
        return lst[0]["id"]
    pytest.skip("No existing campaign; skip to save LLM budget")


def test_list_campaigns():
    r = requests.get(f"{API}/campaigns", timeout=30)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_get_campaign(campaign_id):
    r = requests.get(f"{API}/campaigns/{campaign_id}", timeout=30)
    assert r.status_code == 200
    d = r.json()
    for k in ("id", "name", "topic", "platforms", "posts"):
        assert k in d
    assert d["id"] == campaign_id
    assert isinstance(d["posts"], list)


def test_get_campaign_404():
    r = requests.get(f"{API}/campaigns/does-not-exist-xyz", timeout=30)
    assert r.status_code == 404


def test_update_campaign_persists(campaign_id):
    # get current
    orig = requests.get(f"{API}/campaigns/{campaign_id}", timeout=30).json()
    new_name = orig["name"]  # keep name to not disturb; update via posts field
    posts = orig["posts"]
    if posts:
        posts[0]["content"] = posts[0]["content"]  # no-op content
    r = requests.put(f"{API}/campaigns/{campaign_id}", json={
        "name": new_name,
        "posts": posts,
        "email_copy": orig.get("email_copy", ""),
    }, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["name"] == new_name


def test_export_markdown(campaign_id):
    r = requests.get(f"{API}/campaigns/{campaign_id}/export/markdown", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["format"] == "markdown"
    assert d["filename"].endswith(".md")
    assert d["content"].startswith("# ")


def test_export_txt(campaign_id):
    r = requests.get(f"{API}/campaigns/{campaign_id}/export/txt", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["format"] == "txt"
    assert d["filename"].endswith(".txt")
    assert len(d["content"]) > 0


def test_export_html(campaign_id):
    r = requests.get(f"{API}/campaigns/{campaign_id}/export/html", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["format"] == "html"
    assert d["filename"].endswith(".html")
    assert "<!DOCTYPE html>" in d["content"]


def test_export_invalid_format(campaign_id):
    r = requests.get(f"{API}/campaigns/{campaign_id}/export/pdf", timeout=30)
    assert r.status_code == 400


def test_export_unknown_id():
    r = requests.get(f"{API}/campaigns/no-such-id/export/markdown", timeout=30)
    assert r.status_code == 404


def test_article_export_txt():
    # article txt export new feature
    r = requests.get(f"{API}/articles", timeout=30)
    assert r.status_code == 200
    arts = r.json()
    if not arts:
        pytest.skip("No article to test txt export")
    aid = arts[0]["id"]
    r = requests.get(f"{API}/articles/{aid}/export/txt", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert d["format"] == "txt"
    assert d["filename"].endswith(".txt")
    assert len(d["content"]) > 0
