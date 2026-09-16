"""Iteration 8: Campaign deck PDF + Article→Campaign promote (single LLM call)."""
import io
import os
import re
import pytest
import requests
import fitz  # pymupdf

from dotenv import load_dotenv
load_dotenv("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
CAMPAIGN_ID = "12e4723b-5378-46cd-9d5c-42b5d63b77c3"
ARTICLE_ID = "aa74874f-d686-459b-8bcd-0e36dc8fe3e2"


# ---- Deck PDF tests ----

def test_deck_pdf_headers_and_body():
    r = requests.get(f"{BASE}/api/campaigns/{CAMPAIGN_ID}/deck.pdf", timeout=60)
    assert r.status_code == 200, r.text[:400]
    assert "application/pdf" in r.headers.get("content-type", "")
    cd = r.headers.get("content-disposition", "")
    assert "attachment" in cd.lower()
    assert re.search(r"[\w-]+-deck\.pdf", cd)
    assert r.content[:4] == b"%PDF"


def test_deck_pdf_structure():
    # Fetch campaign to know posts / email
    c = requests.get(f"{BASE}/api/campaigns/{CAMPAIGN_ID}", timeout=30).json()
    expected_pages = 1 + len(c["posts"]) + (1 if c.get("email_copy") else 0) + 1

    r = requests.get(f"{BASE}/api/campaigns/{CAMPAIGN_ID}/deck.pdf", timeout=60)
    doc = fitz.open(stream=r.content, filetype="pdf")
    assert doc.page_count == expected_pages, f"expected {expected_pages} got {doc.page_count}"

    # Landscape orientation
    p0 = doc[0]
    assert p0.rect.width > p0.rect.height

    # Cover contains campaign name
    cover_text = p0.get_text()
    assert c["name"] in cover_text, f"cover missing name: {cover_text[:200]}"

    # Check platform label on some post page and image on post-with-graphic
    platforms_expected = {p["platform"].upper() for p in c["posts"]}
    found_platforms = set()
    found_image_on_graphic_page = False
    posts_with_graphic = [i for i, p in enumerate(c["posts"]) if p.get("graphic_path")]
    for i, post in enumerate(c["posts"]):
        page = doc[1 + i]
        text = page.get_text()
        if post["platform"].upper() in text:
            found_platforms.add(post["platform"].upper())
        if i in posts_with_graphic and len(page.get_images()) > 0:
            found_image_on_graphic_page = True

    assert found_platforms & platforms_expected, f"no platform labels found. Expected any of {platforms_expected}"
    if posts_with_graphic:
        assert found_image_on_graphic_page, "no image on any post page that has graphic_path"
    doc.close()


def test_deck_pdf_unknown_campaign_404():
    r = requests.get(f"{BASE}/api/campaigns/does-not-exist/deck.pdf", timeout=30)
    assert r.status_code == 404


# ---- Article -> Campaign generation (1 LLM call) ----

def test_generate_campaign_from_article():
    art = requests.get(f"{BASE}/api/articles/{ARTICLE_ID}", timeout=30).json()
    payload = {
        "topic": art["title"],
        "goal": "Drive readers to the article — [ARTICLE LINK]",
        "platforms": ["facebook", "linkedin"],
        "include_email": False,
        "source_article_id": ARTICLE_ID,
    }
    r = requests.post(f"{BASE}/api/campaigns/generate", json=payload, timeout=180)
    assert r.status_code == 200, r.text[:400]
    cid = r.json().get("campaign_id") or r.json().get("id")
    assert cid

    g = requests.get(f"{BASE}/api/campaigns/{cid}", timeout=30)
    assert g.status_code == 200
    camp = g.json()
    assert camp.get("source_article_id") == ARTICLE_ID
    # Posts should mention article content or link
    joined = " ".join(p.get("content", "") for p in camp.get("posts", [])).lower()
    assert ("cold brew" in joined) or ("[article link]" in joined) or ("article" in joined), \
        f"posts don't seem to reference article: {joined[:400]}"
