const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Create app FIRST
const app = express();

// ==================== CONFIGURATION ====================

const PORT = process.env.PORT || 5000;
const DOCUMENTS_DIR = path.join(__dirname, 'documents');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure directories exist
[DOCUMENTS_DIR, UPLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[INFO] Created directory: ${dir}`);
  }
});

// ==================== MIDDLEWARE ====================

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ==================== DIRECTORY LISTING ====================

app.get('/documents', (req, res) => {
  try {
    if (!fs.existsSync(DOCUMENTS_DIR)) {
      return res.json({
        success: true,
        directory: DOCUMENTS_DIR,
        files: [],
        message: 'Documents directory is empty'
      });
    }

    const walkDir = (dir, base = '') => {
      let files = [];
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (e) {
        return files;
      }
      for (const entry of entries) {
        const relPath = base ? `${base}/${entry.name}` : entry.name;
        const absPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files = files.concat(walkDir(absPath, relPath));
        } else {
          let size = 0;
          try { size = fs.statSync(absPath).size; } catch (_) {}
          files.push({
            name: entry.name,
            path: relPath,
            url:  `http://localhost:${PORT}/documents/${relPath.replace(/\\/g, '/')}`,
            size,
          });
        }
      }
      return files;
    };

    const files = walkDir(DOCUMENTS_DIR);
    res.json({
      success:   true,
      directory: DOCUMENTS_DIR,
      count:     files.length,
      files,
    });

  } catch (err) {
    console.error('[DOCUMENTS-DIR] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/uploads', (req, res) => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      return res.json({ success: true, files: [], message: 'Uploads directory is empty' });
    }
    const files = fs.readdirSync(UPLOADS_DIR, { withFileTypes: true })
      .filter(e => e.isFile())
      .map(e => {
        let size = 0;
        try { size = fs.statSync(path.join(UPLOADS_DIR, e.name)).size; } catch (_) {}
        return {
          name: e.name,
          url:  `http://localhost:${PORT}/uploads/${e.name}`,
          size,
        };
      });
    res.json({ success: true, count: files.length, files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== STATIC FILE SERVING ====================

app.use('/documents', express.static(DOCUMENTS_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.toLowerCase().endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Accept-Ranges', 'bytes');
  }
}));

app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

console.log(`[STATIC] Documents served at: http://localhost:${PORT}/documents/`);
console.log(`[STATIC] Uploads served at:   http://localhost:${PORT}/uploads/`);

// ==================== ROUTES ====================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'running',
    timestamp: new Date().toISOString(),
    directories: {
      documents: DOCUMENTS_DIR,
      uploads: UPLOADS_DIR
    },
    endpoints: {
      static: '/documents/[path]',
      directoryListing: '/documents',
      api: '/api/documents',
      health: '/api/health'
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// STEP 1 FIX: IMPORT DOCUMENTS ROUTER CORRECTLY
// ═══════════════════════════════════════════════════════════════

try {
  const documentsRouter = require('./documents'); // Your documents.js file
  app.use('/api/documents', documentsRouter);
  console.log('[ROUTES] ✓ documentsRouter loaded from ./documents.js');
} catch (err) {
  console.error('[ROUTES] ✗ documentsRouter failed:', err.message);
}

// Try to load other routes if they exist
try {
  const uploadRoutes = require('./routes/uploadRoutes');
  app.use('/api/upload', uploadRoutes);
  console.log('[ROUTES] ✓ uploadRoutes loaded (legacy)');
} catch (err) {
  console.log('[ROUTES] - uploadRoutes not found (using documents router)');
}

try {
  const fileRoutes = require('./routes/fileRoutes');
  app.use('/api/files', fileRoutes);
  console.log('[ROUTES] ✓ fileRoutes loaded');
} catch (err) {
  console.log('[ROUTES] - fileRoutes not found');
}

// ==================== MAIN ROUTES ====================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Intelligent Document Organizer API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      documents: 'GET /api/documents',
      upload: 'POST /api/documents/upload',
      fileById: 'GET /api/documents/:id/file',
      downloadById: 'GET /api/documents/:id/download',
      bookmarkToggle: 'PUT /api/documents/:id/bookmark',
      deleteDoc: 'DELETE /api/documents/:id',
      categories: 'GET /api/documents/meta/categories',
      dirListing: 'GET /documents',
      staticFiles: 'GET /documents/[filename]'
    }
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.url,
    method: req.method,
    suggestion: 'Check /api/health for available endpoints'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ==================== START SERVER ====================

async function startServer() {
  try {
    // Try to initialize database if available
    try {
      const database = require('./models/database');
      console.log('[INFO] Initializing database...');
      await database.initialize();
    } catch (e) {
      console.log('[INFO] Database not available, using filesystem mode');
    }

    // Try to initialize categorization service if available
    try {
      const categorizationService = require('./services/categorizationService');
      console.log('[INFO] Initializing categorization service...');
      await categorizationService.initialize();
    } catch (e) {
      console.log('[INFO] Categorization service not available');
    }

    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log(`[INFO] 🚀 Backend server running on http://localhost:${PORT}`);
      console.log('='.repeat(60));
      console.log('\n📌 Available endpoints:');
      console.log(`   • Health:      http://localhost:${PORT}/api/health`);
      console.log(`   • Documents:   http://localhost:${PORT}/api/documents`);
      console.log(`   • Upload:      POST http://localhost:${PORT}/api/documents/upload`);
      console.log(`   • File serve:  http://localhost:${PORT}/api/documents/:id/file`);
      console.log(`   • Dir list:    http://localhost:${PORT}/documents`);
      console.log(`   • Static:      http://localhost:${PORT}/documents/[filename]`);
      console.log('\n🔧 Debug endpoints:');
      console.log(`   • Test API:    http://localhost:${PORT}/api/health`);
      console.log(`   • Root info:   http://localhost:${PORT}/`);
      console.log('\n');
    });

  } catch (error) {
    console.error('[FATAL] Failed to start:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[INFO] Shutting down...');
  try {
    const database = require('./models/database');
    await database.close();
  } catch (e) {}
  process.exit(0);
});