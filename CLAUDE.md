# SENTINEL

Swiss Epidemic Notification and Threat Intelligence Engine.

## Project Structure
- `backend/` — Python FastAPI backend (collectors, analysis, API)
- `frontend/` — Next.js dashboard
- `data/` — Pipeline output (JSON files, committed to repo)
- `docs/` — Documentation

## Backend
- Python 3.12+, managed with uv
- FastAPI + Pydantic models
- Run: `cd backend && uv run python -m sentinel.pipeline`
- Test: `cd backend && uv run pytest`
- Lint: `cd backend && uv run ruff check .`

## Frontend
- Next.js 14, TypeScript, Tailwind CSS
- Run: `cd frontend && npm run dev`
- Build: `cd frontend && npm run build`
- Test: `cd frontend && npm test`

## Conventions
- All data models use Pydantic v2
- Collectors implement BaseCollector ABC
- ISO 3166 alpha-2 for country codes
- Risk scores: 0-10 float scale
- Risk categories: CRITICAL (8-10), HIGH (6-8), MEDIUM (4-6), LOW (0-4)
