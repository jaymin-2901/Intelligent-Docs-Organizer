# Deployment Guide

This guide covers preparing, pushing, and deploying Intelligent Document Organizer.

## 1. Prerequisites

- Git
- Node.js 20+
- Docker + Docker Compose (recommended)
- Python 3.10+ (for local non-Docker AI runtime)

## 2. Environment Variables

### Backend (`backend/.env`)

Copy from `backend/.env.example` and set production values:

- `NODE_ENV=production`
- `HOST=0.0.0.0`
- `PORT=5000`
- `JWT_SECRET` (required, use strong secret)
- `JWT_EXPIRES_IN` (default `7d`)
- `JWT_REMEMBER_EXPIRES` (default `30d`)
- `CLIENT_URL` (frontend URL)
- `DB_PATH` (SQLite file path)
- `UPLOAD_DIR`
- `DOCUMENTS_DIR`
- `PYTHON_PATH`
- `PYTHON_COMMAND`

### Frontend (`frontend/.env`)

Copy from `frontend/.env.example`:

- Local/dev: `VITE_API_URL=http://localhost:5000/api`
- Reverse-proxy/prod: `VITE_API_URL=/api`

## 3. Local Build Validation

From project root:

```powershell
cd backend
npm install

cd ../frontend
npm install
npm run build
```

## 4. Docker Deployment (Recommended)

The repository includes:

- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/nginx.conf`
- `docker-compose.yml`

Run from project root:

```powershell
docker compose up -d --build
```

Services:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:5000`
- Health check: `http://localhost:5000/api/health`

Stop services:

```powershell
docker compose down
```

View logs:

```powershell
docker compose logs -f backend
docker compose logs -f frontend
```

## 5. GitHub Push Workflow

Set remote to the target repository (if needed):

```powershell
git remote set-url origin https://github.com/jaymin-2901/Intelligent-Docs-Organizer.git
```

Push main branch:

```powershell
git add -A
git commit -m "Prepare deployment: guide, docker setup, and runtime config"
git push origin main
```

## 6. Production Notes

- Do not use default `JWT_SECRET` in production.
- Keep `storage/` backed up (SQLite DB + uploaded files).
- Place app behind HTTPS reverse proxy in production.
- Restrict CORS to trusted frontend origin if public-facing.
