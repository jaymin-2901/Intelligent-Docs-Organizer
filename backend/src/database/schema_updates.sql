-- backend/database/schema_updates.sql

-- Track document views/opens
CREATE TABLE IF NOT EXISTS document_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    view_duration_seconds INTEGER DEFAULT 0,
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

-- Track user activity sessions
CREATE TABLE IF NOT EXISTS activity_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_date DATE NOT NULL,
    documents_opened INTEGER DEFAULT 0,
    documents_uploaded INTEGER DEFAULT 0,
    total_time_seconds INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Store extracted topics per document
CREATE TABLE IF NOT EXISTS document_topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    topic TEXT NOT NULL,
    relevance_score REAL DEFAULT 0.0,
    FOREIGN KEY (document_id) REFERENCES documents(id)
);