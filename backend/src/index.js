/**
 * Express Server Entry Point
 * Intelligent Document Organizer Backend + Auth
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { protect } = require('../middleware/auth');
const authRoutes = require('../routes/authRoutes');

// Config
let config;
try {
  config = require('./config/config');
} catch (e) {
  config = { server: { port: 5000, host: 'localhost' }, storage: {} };
}

// Services (existing)
let database, categorizationService;
try {
  database = require('./models/database');
  categorizationService = require('./services/categorizationService');
} catch (e) {
  console.warn('Services optional - using fallbacks');
}

// Logger
let logger = {
  info: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
};

// Constants
const PORT = process.env.PORT || config.server?.port || 5000;
const HOST = config.server?.host || 'localhost';

const app = express();

// Directories
const uploadsDir = config.storage?.uploadPath || path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const documentsDir = config.storage?.documentsPath || path.join(__dirname, '../documents');
if (!fs.existsSync(documentsDir)) fs.mkdirSync(documentsDir, { recursive: true });

// Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8').replace(/\s+/g, '_');
    cb(null, `${timestamp}_${safeName}`);
  }
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['pdf', 'docx', 'doc', 'txt', 'pptx', 'xlsx', 'jpg', 'jpeg', 'png', 'gif'];
    const ext = path.extname(file.originalname).toLowerCase().substring(1);
    cb(null, allowed.includes(ext));
  }
});

// Middleware (existing + auth)
app.use(cors({ origin: '*', credentials: false, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['*'] }));
app.use(helmet({ contentSecurityPolicy: false, frameguard: false, hsts: false }));
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('X-Frame-Options', 'ALLOWALL');
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('combined'));

// Static (existing)
app.use('/uploads', express.static(uploadsDir, { etag: false }));
app.use('/documents', express.static(documentsDir, { etag: false }));

// API Routes - NEW AUTH FIRST
app.use('/api/auth', authRoutes);

// PROTECTED DOCS ROUTES (existing routes)
app.use('/api/documents', protect);
app.use('/api/analytics', protect);

// Dynamic route loads (existing)
let uploadRoutes = express.Router(), documentRoutes = express.Router(), analyticsRoutes = express.Router();
try { uploadRoutes = require('./routes/uploadRoutes'); } catch (e) { console.warn('No uploadRoutes.js'); }
try { documentRoutes = require('./routes/documents'); } catch (e) { console.warn('No documents.js'); }
try { analyticsRoutes = require('./routes/analytics'); } catch (e) { console.warn('No analytics.js'); }
app.use('/api', uploadRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/analytics', analyticsRoutes);

// Legacy (existing)
app.post('/api/upload-simple', upload.array('documents', 10), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files' });
  const files = req.files.map(f => ({
    id: Date.now() + Math.random(),
    originalName: f.originalname,
    filename: f.filename,
    size: f.size,
    url: `/uploads/${f.filename}`
  }));
  res.json({ success: true, files });
});

app.get('/api/documents-legacy', (req, res) => {
  const files = fs.readdirSync(uploadsDir).map(f => {
    const p = path.join(uploadsDir, f);
    const s = fs.statSync(p);
    return { id: f, originalName: f.replace(/^\d+_/, ''), size: s.size, url: `/uploads/${f}` };
  });
  res.json({ success: true, documents: files });
});

app.delete('/api/documents-legacy/:filename', (req, res) => {
  const p = path.join(uploadsDir, req.params.filename);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    return res.json({ success: true });
  }
  res.status(404).json({ success: false });
});

// Health (existing + auth status)
app.get('/api/health', async (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    authStorage: 'sqlite',
    endpoints: ['/api/auth/login', '/api/auth/signup', '/api/documents']
  });
});

app.get('/', (req, res) => res.json({ name: 'Doc Organizer API + Auth', endpoints: ['/api/auth/*', '/api/documents'] }));

// 404/Error (existing)
app.use((req, res) => res.status(404).json({ success: false, path: req.path }));
app.use((err, req, res) => res.status(500).json({ success: false, error: err.message }));

// Start Server
async function startServer() {
  try {
    logger.info('🚀 Starting backend...');

    // Existing inits
    if (database?.initialize) await database.initialize();
    if (categorizationService?.initialize) await categorizationService.initialize();
    
    app.listen(PORT, HOST, () => {
      logger.info(`✅ Backend @ http://${HOST}:${PORT}`);
      logger.info('   Auth: /api/auth/login POST');
      logger.info('   Protected docs: /api/documents');
    });
  } catch (err) {
    logger.error('Failed to start:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
