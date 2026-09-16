from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Request
from fastapi.responses import Response
from dotenv import load_dotenv
import requests
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from bs4 import BeautifulSoup
import asyncio
import base64
import json
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Emergent object storage
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "article-writer"
storage_key = None

def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ.get("EMERGENT_LLM_KEY")}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple:
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# Create the main app without a prefix
app = FastAPI()

@app.on_event("startup")
async def startup_storage():
    try:
        await asyncio.to_thread(init_storage)
        logging.info("Storage initialized")
    except Exception as e:
        logging.error(f"Storage init failed: {e}")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

CLAUDE_MODEL = "claude-sonnet-4-6"
PLATFORMS = ["facebook", "instagram", "linkedin", "twitter", "tiktok"]

def fetch_reference_text(url: str) -> str:
    resp = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0 (compatible; ArticleWriterBot/1.0)"})
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "svg"]):
        tag.decompose()
    text = " ".join(soup.get_text(" ").split())
    return text[:6000]

async def build_research_block(reference_urls: List[str]) -> str:
    if not reference_urls:
        return ""
    parts = []
    for url in reference_urls[:5]:
        try:
            text = await asyncio.to_thread(fetch_reference_text, url)
            parts.append(f"SOURCE: {url}\n{text}")
        except Exception as e:
            logging.warning(f"Could not fetch reference {url}: {e}")
            parts.append(f"SOURCE: {url}\n(could not be fetched)")
    return "\n\nREFERENCE MATERIAL (use as research, do not copy verbatim):\n\n" + "\n\n---\n\n".join(parts)

async def build_image_contents(image_paths: List[str]) -> List[ImageContent]:
    contents = []
    for path in image_paths[:5]:
        try:
            data, _ = await asyncio.to_thread(get_object, path)
            contents.append(ImageContent(image_base64=base64.b64encode(data).decode()))
        except Exception as e:
            logging.warning(f"Could not load image {path}: {e}")
    return contents

def image_instruction(image_paths: List[str], public_base: str) -> str:
    if not image_paths:
        return ""
    urls = "\n".join(f"IMAGE {i+1}: {public_base}/api/files/{p}" for i, p in enumerate(image_paths))
    return f"\n\nATTACHED IMAGES: The user attached {len(image_paths)} image(s), shown in order. Study each one and describe what it shows (products, scenes, people, text). Reference them naturally in the content.\n{urls}"

def public_base_url(request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.headers.get("host", request.url.netloc))
    return f"{proto}://{host}"

def new_chat(system_message: str) -> LlmChat:
    return LlmChat(
        api_key=os.environ['EMERGENT_LLM_KEY'],
        session_id=f"gen-{uuid.uuid4()}",
        system_message=system_message
    ).with_model("anthropic", CLAUDE_MODEL)

def parse_json_block(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    return json.loads(match.group(0) if match else text)

def iso_to_dt(doc: dict) -> dict:
    for k in ("created_at", "updated_at"):
        if isinstance(doc.get(k), str):
            doc[k] = datetime.fromisoformat(doc[k])
    return doc

# Define Models
class ArticleCreate(BaseModel):
    topic: str
    keywords: Optional[str] = None
    tone: Optional[str] = "professional"
    reference_urls: List[str] = []
    image_paths: List[str] = []

class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    url_slug: Optional[str] = None

class Article(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    topic: str
    keywords: Optional[str] = None
    title: str
    content: str
    meta_title: str
    meta_description: str
    url_slug: str
    reference_urls: List[str] = []
    image_paths: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GenerateResponse(BaseModel):
    article_id: str
    message: str

class CampaignPost(BaseModel):
    platform: str
    content: str
    hashtags: str = ""

class CampaignCreate(BaseModel):
    topic: str
    goal: Optional[str] = None
    keywords: Optional[str] = None
    tone: Optional[str] = "engaging"
    platforms: List[str] = PLATFORMS
    include_email: bool = True
    reference_urls: List[str] = []
    image_paths: List[str] = []

class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    posts: Optional[List[CampaignPost]] = None
    email_copy: Optional[str] = None

class Campaign(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    topic: str
    goal: Optional[str] = None
    keywords: Optional[str] = None
    tone: Optional[str] = None
    platforms: List[str] = []
    posts: List[CampaignPost] = []
    email_copy: str = ""
    reference_urls: List[str] = []
    image_paths: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Routes
@api_router.get("/")
async def root():
    return {"message": "AI-Powered Article Writer API"}

ARTICLE_FORMAT = """Provide the following in a structured format:
1. ARTICLE_TITLE: A compelling, SEO-friendly title (60-70 characters)
2. ARTICLE_CONTENT: A well-structured, engaging article (1500-2000 words) with:
   - Clear introduction
   - Multiple sections with subheadings
   - Informative content with examples
   - Strong conclusion
   - Natural keyword integration
3. META_TITLE: SEO meta title (50-60 characters)
4. META_DESCRIPTION: Compelling meta description (150-160 characters)
5. URL_SLUG: Clean, SEO-friendly URL slug

Format your response as:

ARTICLE_TITLE:
[title here]

ARTICLE_CONTENT:
[full article content here]

META_TITLE:
[meta title here]

META_DESCRIPTION:
[meta description here]

URL_SLUG:
[url-slug-here]"""

ARTICLE_SECTIONS = {"ARTICLE_TITLE": "title", "ARTICLE_CONTENT": "content", "META_TITLE": "meta_title",
                    "META_DESCRIPTION": "meta_description", "URL_SLUG": "url_slug"}

def build_article_prompt(input_data: ArticleCreate, research: str, image_note: str) -> str:
    keywords_text = f" focusing on keywords: {input_data.keywords}" if input_data.keywords else ""
    if input_data.image_paths:
        image_note += "\n\nIn ARTICLE_CONTENT, insert each image exactly once where it fits best using markdown: ![descriptive alt text](IMAGE URL). Alt text must describe the actual image content for SEO."
    return f"Create a comprehensive, SEO-optimized article about: {input_data.topic}{keywords_text}\n\nTone: {input_data.tone}{research}{image_note}\n\n{ARTICLE_FORMAT}"

def slugify(text: str, fallback: str = "article") -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:50] or fallback

def parse_article_response(response: str, topic: str, keywords: Optional[str]) -> dict:
    result = {"topic": topic, "keywords": keywords}
    pattern = "|".join(ARTICLE_SECTIONS)
    for match in re.finditer(rf"^\s*({pattern}):\s*(.*?)(?=^\s*(?:{pattern}):|\Z)", response, re.M | re.S):
        result[ARTICLE_SECTIONS[match.group(1)]] = match.group(2).strip()
    title = result.get("title") or f"Article: {topic}"
    return {
        **result,
        "title": title,
        "content": result.get("content") or response,
        "meta_title": result.get("meta_title") or title[:60],
        "meta_description": result.get("meta_description") or f"Comprehensive guide about {topic}"[:160],
        "url_slug": result.get("url_slug") or slugify(topic),
    }

async def insert_timestamped(collection, model: BaseModel) -> None:
    doc = model.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await collection.insert_one(doc)

@api_router.post("/articles/generate", response_model=GenerateResponse)
async def generate_article(input_data: ArticleCreate, request: Request):
    try:
        chat = new_chat("You are an expert SEO content writer who creates high-quality, engaging articles optimized for search engines and AI answer engines (GEO).")
        research = await build_research_block(input_data.reference_urls)
        images = await build_image_contents(input_data.image_paths)
        image_note = image_instruction(input_data.image_paths, public_base_url(request))
        prompt = build_article_prompt(input_data, research, image_note)
        response = await chat.send_message(UserMessage(text=prompt, file_contents=images))

        article_data = parse_article_response(response, input_data.topic, input_data.keywords)
        article = Article(**article_data, reference_urls=input_data.reference_urls, image_paths=input_data.image_paths)
        await insert_timestamped(db.articles, article)
        return GenerateResponse(article_id=article.id, message="Article generated successfully")
    except Exception as e:
        logging.error(f"Error generating article: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating article: {str(e)}")

@api_router.get("/articles", response_model=List[Article])
async def get_articles():
    articles = await db.articles.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for article in articles:
        if isinstance(article.get('created_at'), str):
            article['created_at'] = datetime.fromisoformat(article['created_at'])
        if isinstance(article.get('updated_at'), str):
            article['updated_at'] = datetime.fromisoformat(article['updated_at'])
    
    # Sort by created_at descending
    articles.sort(key=lambda x: x.get('created_at', datetime.min), reverse=True)
    return articles

@api_router.get("/articles/{article_id}", response_model=Article)
async def get_article(article_id: str):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Convert ISO string timestamps back to datetime objects
    if isinstance(article.get('created_at'), str):
        article['created_at'] = datetime.fromisoformat(article['created_at'])
    if isinstance(article.get('updated_at'), str):
        article['updated_at'] = datetime.fromisoformat(article['updated_at'])
    
    return article

@api_router.put("/articles/{article_id}", response_model=Article)
async def update_article(article_id: str, update_data: ArticleUpdate):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    if update_dict:
        update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
        await db.articles.update_one(
            {"id": article_id},
            {"$set": update_dict}
        )
    
    # Fetch updated article
    updated_article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    
    # Convert timestamps
    if isinstance(updated_article.get('created_at'), str):
        updated_article['created_at'] = datetime.fromisoformat(updated_article['created_at'])
    if isinstance(updated_article.get('updated_at'), str):
        updated_article['updated_at'] = datetime.fromisoformat(updated_article['updated_at'])
    
    return updated_article

@api_router.delete("/articles/{article_id}")
async def delete_article(article_id: str):
    result = await db.articles.delete_one({"id": article_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Article not found")
    
    return {"message": "Article deleted successfully"}

async def storage_call(fn, *args, error: str, status: int):
    try:
        return await asyncio.to_thread(fn, *args)
    except Exception as e:
        logging.error(f"{error}: {str(e)}")
        raise HTTPException(status_code=status, detail=error)

@api_router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed")

    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image size must be less than 5MB")

    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else "bin"
    path = f"{APP_NAME}/uploads/{uuid.uuid4()}.{ext}"
    result = await storage_call(put_object, path, data, file.content_type, error="Error uploading image", status=500)

    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"url": f"/api/files/{result['path']}", "filename": file.filename}

@api_router.get("/files/{path:path}")
async def get_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type = await storage_call(get_object, path, error="File not found", status=404)
    return Response(content=data, media_type=record.get("content_type") or content_type,
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})

PLATFORM_RULES = {
    "facebook": "Facebook post: 80-150 words, conversational, 1-2 emojis max, a clear call to action, 3-5 hashtags.",
    "instagram": "Instagram caption: hook in first line, 100-150 words, line breaks for readability, emojis welcome, 10-15 hashtags.",
    "linkedin": "LinkedIn post: professional, 150-250 words, short paragraphs, insight-driven, ends with a question, 3-5 hashtags.",
    "twitter": "X/Twitter: a thread of 3-5 tweets, each under 280 characters, numbered like 1/, 2/, punchy, 1-3 hashtags in last tweet.",
    "tiktok": "TikTok: a 30-45 second video script with [HOOK], [SCENE] beats and on-screen text cues, plus a caption under 150 characters, 4-6 hashtags.",
}

def build_campaign_prompt(input_data: CampaignCreate, platforms: List[str], research: str, image_note: str) -> str:
    rules = "\n".join(f"- {p}: {PLATFORM_RULES[p]}" for p in platforms)
    email_rule = '\n  "email_copy": "a short promotional email (subject line on first line, then 120-180 words body)",' if input_data.include_email else ''
    return f"""Create a cohesive social media campaign.

TOPIC / PRODUCT: {input_data.topic}
GOAL / CALL TO ACTION: {input_data.goal or 'raise awareness and drive engagement'}
KEYWORDS: {input_data.keywords or 'none'}
TONE: {input_data.tone}{research}{image_note}

Write one post per platform following these rules:
{rules}

Respond ONLY with JSON in this exact shape:
{{
  "name": "short campaign name (max 8 words)",{email_rule}
  "posts": [
    {{"platform": "{platforms[0]}", "content": "post text", "hashtags": "#tag1 #tag2"}}
  ]
}}
Include exactly these platforms in order: {", ".join(platforms)}. Do not put hashtags inside content; put them in the hashtags field."""

def campaign_from_response(response: str, input_data: CampaignCreate, platforms: List[str]) -> Campaign:
    data = parse_json_block(response)
    posts = [CampaignPost(platform=p.get("platform", ""), content=p.get("content", ""), hashtags=p.get("hashtags", "")) for p in data.get("posts", [])]
    return Campaign(
        name=data.get("name") or f"Campaign: {input_data.topic}",
        topic=input_data.topic, goal=input_data.goal, keywords=input_data.keywords, tone=input_data.tone,
        platforms=platforms, posts=posts, email_copy=data.get("email_copy") or "",
        reference_urls=input_data.reference_urls, image_paths=input_data.image_paths,
    )

@api_router.post("/campaigns/generate")
async def generate_campaign(input_data: CampaignCreate, request: Request):
    platforms = [p for p in input_data.platforms if p in PLATFORMS] or PLATFORMS
    try:
        chat = new_chat("You are a senior social media strategist and copywriter. You write platform-native, high-converting campaign content. You always answer with valid JSON only.")
        research = await build_research_block(input_data.reference_urls)
        images = await build_image_contents(input_data.image_paths)
        image_note = image_instruction(input_data.image_paths, public_base_url(request))
        prompt = build_campaign_prompt(input_data, platforms, research, image_note)
        response = await chat.send_message(UserMessage(text=prompt, file_contents=images))
        campaign = campaign_from_response(response, input_data, platforms)
        await insert_timestamped(db.campaigns, campaign)
        return {"campaign_id": campaign.id, "message": "Campaign generated successfully"}
    except Exception as e:
        logging.error(f"Error generating campaign: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating campaign: {str(e)}")

@api_router.get("/campaigns", response_model=List[Campaign])
async def get_campaigns():
    docs = await db.campaigns.find({}, {"_id": 0}).to_list(1000)
    docs = [iso_to_dt(d) for d in docs]
    docs.sort(key=lambda x: x.get('created_at', datetime.min), reverse=True)
    return docs

@api_router.get("/campaigns/{campaign_id}", response_model=Campaign)
async def get_campaign(campaign_id: str):
    doc = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return iso_to_dt(doc)

@api_router.put("/campaigns/{campaign_id}", response_model=Campaign)
async def update_campaign(campaign_id: str, update_data: CampaignUpdate):
    if not await db.campaigns.find_one({"id": campaign_id}):
        raise HTTPException(status_code=404, detail="Campaign not found")
    update_dict = update_data.model_dump(exclude_unset=True)
    update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
    await db.campaigns.update_one({"id": campaign_id}, {"$set": update_dict})
    return iso_to_dt(await db.campaigns.find_one({"id": campaign_id}, {"_id": 0}))

@api_router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: str):
    result = await db.campaigns.delete_one({"id": campaign_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"message": "Campaign deleted successfully"}

def campaign_markdown(c: dict) -> str:
    body = "\n\n".join(f"## {p['platform'].title()}\n\n{p['content']}\n\n{p['hashtags']}" for p in c['posts'])
    email = f"\n\n## Email\n\n{c['email_copy']}" if c.get('email_copy') else ""
    return f"# {c['name']}\n\n**Topic:** {c['topic']}\n\n{body}{email}"

def campaign_txt(c: dict) -> str:
    body = "\n\n".join(f"=== {p['platform'].upper()} ===\n{p['content']}\n{p['hashtags']}" for p in c['posts'])
    email = f"\n\n=== EMAIL ===\n{c['email_copy']}" if c.get('email_copy') else ""
    return f"{c['name']}\n\n{body}{email}"

def campaign_html(c: dict) -> str:
    br = lambda s: s.replace(chr(10), '<br>')
    posts = "".join(f"<section><h2>{p['platform'].title()}</h2><p>{br(p['content'])}</p><p><em>{p['hashtags']}</em></p></section>" for p in c['posts'])
    email = f"<section><h2>Email</h2><p>{br(c['email_copy'])}</p></section>" if c.get('email_copy') else ""
    return f"<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\"><title>{c['name']}</title></head><body><h1>{c['name']}</h1>{posts}{email}</body></html>"

CAMPAIGN_EXPORTERS = {"markdown": (campaign_markdown, "md"), "txt": (campaign_txt, "txt"), "html": (campaign_html, "html")}

@api_router.get("/campaigns/{campaign_id}/export/{format}")
async def export_campaign(campaign_id: str, format: str):
    c = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if format not in CAMPAIGN_EXPORTERS:
        raise HTTPException(status_code=400, detail="Unsupported format. Use 'markdown', 'txt' or 'html'")
    render, ext = CAMPAIGN_EXPORTERS[format]
    return {"format": format, "content": render(c), "filename": f"{slugify(c['name'], 'campaign')}.{ext}"}

@api_router.get("/articles/{article_id}/export/{format}")
async def export_article(article_id: str, format: str):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    if format == "markdown":
        content = f"# {article['title']}\n\n{article['content']}\n\n---\n\n**Meta Title:** {article['meta_title']}\n\n**Meta Description:** {article['meta_description']}\n\n**URL Slug:** {article['url_slug']}"
        return {"format": "markdown", "content": content, "filename": f"{article['url_slug']}.md"}

    elif format == "txt":
        content = f"{article['title']}\n\n{article['content']}"
        return {"format": "txt", "content": content, "filename": f"{article['url_slug']}.txt"}
    
    elif format == "html":
        content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{article['meta_title']}</title>
    <meta name="description" content="{article['meta_description']}">
</head>
<body>
    <article>
        <h1>{article['title']}</h1>
        <div>{article['content'].replace(chr(10), '<br>')}</div>
    </article>
</body>
</html>"""
        return {"format": "html", "content": content, "filename": f"{article['url_slug']}.html"}
    
    else:
        raise HTTPException(status_code=400, detail="Unsupported format. Use 'markdown' or 'html'")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()