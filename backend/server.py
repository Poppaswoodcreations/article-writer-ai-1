from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
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
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio

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

# Define Models
class ArticleCreate(BaseModel):
    topic: str
    keywords: Optional[str] = None
    tone: Optional[str] = "professional"

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GenerateResponse(BaseModel):
    article_id: str
    message: str

# Routes
@api_router.get("/")
async def root():
    return {"message": "AI-Powered Article Writer API"}

@api_router.post("/articles/generate", response_model=GenerateResponse)
async def generate_article(input_data: ArticleCreate):
    try:
        # Initialize Claude Sonnet 4 chat
        chat = LlmChat(
            api_key=os.environ['EMERGENT_LLM_KEY'],
            session_id=f"article-gen-{uuid.uuid4()}",
            system_message="You are an expert SEO content writer who creates high-quality, engaging articles optimized for search engines."
        ).with_model("anthropic", "claude-4-sonnet-20250514")
        
        # Create research and generation prompt
        keywords_text = f" focusing on keywords: {input_data.keywords}" if input_data.keywords else ""
        prompt = f"""Create a comprehensive, SEO-optimized article about: {input_data.topic}{keywords_text}

Tone: {input_data.tone}

Provide the following in a structured format:
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
        
        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse the response
        article_data = parse_article_response(response, input_data.topic, input_data.keywords)
        
        # Save to database
        article = Article(**article_data)
        doc = article.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        
        await db.articles.insert_one(doc)
        
        return GenerateResponse(
            article_id=article.id,
            message="Article generated successfully"
        )
    except Exception as e:
        logging.error(f"Error generating article: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating article: {str(e)}")

def parse_article_response(response: str, topic: str, keywords: Optional[str]) -> dict:
    """Parse the AI response into structured article data"""
    try:
        # Extract sections from response
        sections = {
            'ARTICLE_TITLE:': 'title',
            'ARTICLE_CONTENT:': 'content',
            'META_TITLE:': 'meta_title',
            'META_DESCRIPTION:': 'meta_description',
            'URL_SLUG:': 'url_slug'
        }
        
        result = {
            'topic': topic,
            'keywords': keywords,
            'title': '',
            'content': '',
            'meta_title': '',
            'meta_description': '',
            'url_slug': ''
        }
        
        lines = response.split('\n')
        current_section = None
        content_buffer = []
        
        for line in lines:
            # Check if line starts a new section
            section_found = False
            for marker, field in sections.items():
                if line.strip().startswith(marker):
                    # Save previous section content
                    if current_section and content_buffer:
                        result[current_section] = '\n'.join(content_buffer).strip()
                    # Start new section
                    current_section = field
                    content_buffer = [line.replace(marker, '').strip()]
                    section_found = True
                    break
            
            if not section_found and current_section:
                content_buffer.append(line)
        
        # Save last section
        if current_section and content_buffer:
            result[current_section] = '\n'.join(content_buffer).strip()
        
        # Fallback if parsing fails
        if not result['title']:
            result['title'] = f"Article: {topic}"
        if not result['content']:
            result['content'] = response
        if not result['meta_title']:
            result['meta_title'] = result['title'][:60]
        if not result['meta_description']:
            result['meta_description'] = f"Comprehensive guide about {topic}"
        if not result['url_slug']:
            result['url_slug'] = topic.lower().replace(' ', '-')[:50]
        
        return result
    except Exception as e:
        logging.error(f"Error parsing article response: {str(e)}")
        # Return basic structure with the response
        return {
            'topic': topic,
            'keywords': keywords,
            'title': f"Article: {topic}",
            'content': response,
            'meta_title': f"Article: {topic}"[:60],
            'meta_description': f"Comprehensive guide about {topic}"[:160],
            'url_slug': topic.lower().replace(' ', '-')[:50]
        }

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
    try:
        result = await asyncio.to_thread(put_object, path, data, file.content_type)
    except Exception as e:
        logging.error(f"Error uploading image: {str(e)}")
        raise HTTPException(status_code=500, detail="Error uploading image")

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
    try:
        data, content_type = await asyncio.to_thread(get_object, path)
    except Exception as e:
        logging.error(f"Error fetching file: {str(e)}")
        raise HTTPException(status_code=404, detail="File not found")
    return Response(content=data, media_type=record.get("content_type") or content_type,
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})

@api_router.get("/articles/{article_id}/export/{format}")
async def export_article(article_id: str, format: str):
    article = await db.articles.find_one({"id": article_id}, {"_id": 0})
    
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    if format == "markdown":
        content = f"# {article['title']}\n\n{article['content']}\n\n---\n\n**Meta Title:** {article['meta_title']}\n\n**Meta Description:** {article['meta_description']}\n\n**URL Slug:** {article['url_slug']}"
        return {"format": "markdown", "content": content, "filename": f"{article['url_slug']}.md"}
    
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