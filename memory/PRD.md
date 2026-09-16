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

## Backlog
- P1: Make "Add Image" more discoverable (header button / drag-drop / paste)
- P1: Live markdown preview tab rendering images
- P2: Rich-text (WYSIWYG) editor, PDF/DOCX export
- P2: Client-side error boundary on dashboard

## Testing
- Reports: /app/test_reports/iteration_1..3.json (all passing)
