# Intelligent Document Organizer

A full-stack desktop app (Electron) for AI-powered document management, categorization, and gesture control.

## 🏗️ Project Structure
```
.
├── backend/          # Node.js/Express API + SQLite
├── frontend/         # React + Vite + Electron renderer
├── python/           # AI/ML services (categorization, gestures)
├── storage/          # Data files (gitignore large)
│   ├── documents/    # Organized PDFs/docs by category
│   ├── uploads/      # Raw uploads
│   └── database/     # SQLite DB
├── tests/            # Tests
├── docs/             # Documentation
├── dist/             # Builds
├── TODO.md           # Progress tracker
├── .env.example      # Copy to .env
└── docker-compose.yml (planned)
```

## 🚀 Quick Start

1. **Backend** (http://localhost:5000)
   ```bash
   cd backend
   npm install
   copy ..\storage\database\documents.db src\..\database\  # First run only
   npm run dev
   ```

2. **Frontend** (Electron app)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Python AI** (auto-started)
   ```bash
   cd python
   pip install -r requirements.txt
   ```

## 📁 Key Paths
- **Documents**: `storage/documents/[category]/[file].pdf` → http://localhost:5000/documents/[category]/[file].pdf
- **Uploads**: POST /api/upload
- **API**: /api/health, /api/documents

## Features
- AI document categorization (Education/Work/etc.)
- PDF viewer with gesture controls (MediaPipe)
- Desktop app (Electron)
- SQLite persistence

See `docs/ARCHITECTURE.md` for details.

