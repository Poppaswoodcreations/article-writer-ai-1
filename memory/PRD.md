# AI-Powered Article Writer — PRD

## Original problem statement
Research and create GEO-optimized, top-ranking articles with Meta Title, Meta Description and URL Slug. Save/manage multiple articles, edit generated content, export (markdown/HTML), upload images inside the editor.

## User choices
- LLM: Claude Sonnet via Emergent LLM key (user chose Sonnet 4; upstream retired `claude-4-sonnet-20250514`, now `claude-sonnet-4-6`)
- No auth

## Architecture
- Backend: FastAPI (`/app/backend/server.py`), MongoDB (`articles`, `files` collections)
- Frontend: React + Tailwind + shadcn (`Dashboard.jsx`, `ArticleGenerator.jsx`, `ArticleEditor.jsx`)
- Image storage: Emergent object storage (path prefix `article-writer/uploads/`), served via `GET /api/files/{path}`

## API
- POST /api/articles/generate, GET/PUT/DELETE /api/articles[/{id}], GET /api/articles/{id}/export/{markdown|html}
- POST /api/upload-image -> {url: "/api/files/<path>"}, GET /api/files/{path}

## Implemented (as of 2026-06)
- Generation, dashboard, editor (content + SEO tab), export md/html, image upload dialog ("Add Image" above content textarea)
- 2026-06: Migrated uploads from pod-local `/uploads` to Emergent object storage (deployment-safe)
- 2026-06: Fixed frontend compile error (unused `Eye` lucide import + webpack lazy-barrel bug; craco dev rule added)
- 2026-06: Fixed generation 500 — model id updated to `claude-sonnet-4-6`
- 2026-06: Social media campaigns (facebook/instagram/linkedin/twitter/tiktok + email): generate, list, edit per post, copy, download per post TXT, export all txt/md/html. Endpoints /api/campaigns[...]
- 2026-06: Reference URLs (fetched via requests+bs4, ≤5, 6k chars each) and reference images (Claude vision via ImageContent, inserted into article as markdown with alt text) on both generators (`ReferenceInputs.jsx`)
- 2026-06: Dashboard "Content Studio" with Articles | Campaigns tabs (?tab=); article Preview tab (react-markdown); article TXT export

- 2026-06: Code-review refactor: backend helpers (build_article_prompt, regex parse_article_response, insert_timestamped, storage_call, build_campaign_prompt, campaign_from_response, CAMPAIGN_EXPORTERS); frontend split into ExportDialog, ImageUploadDialog, SeoFields, PostCard, PlatformPicker, HowItWorks; ReferenceInputs → UrlList + ImageUploader (dup URL guard, stable keys); fixed email leaking into platforms list

- 2026-06: Drag-and-drop/paste images into article textarea (`useImageInsert` hook, inserts markdown at cursor)
- 2026-06: Campaign Graphics — PIL headline overlay per platform size (`graphics.py`, bundled LiberationSans-Bold), optional AI enhance via Gemini `gemini-3.1-flash-image-preview`; POST /api/campaigns/{id}/posts/{platform}/graphic; stored in object storage under `article-writer/graphics/`
- 2026-06: Post Scheduler — `scheduled_at` per post, SchedulePicker (calendar+time), SchedulePanel, GET /api/campaigns/{id}/schedule/{csv|ics}
- 2026-06: Regenerate One Post — POST /api/campaigns/{id}/posts/{platform}/regenerate {instruction}

## Backlog
- P2: Bulk "Generate all graphics" for a campaign
- P2: Rich-text (WYSIWYG) editor, PDF/DOCX export
- P2: Month calendar view across all campaigns
- P2: Client-side error boundary on dashboard

## Testing
- Reports: /app/test_reports/iteration_1..6.json (all passing)
