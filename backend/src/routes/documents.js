/**
 * Documents Routes - STEP 1 FIXED VERSION
 * Fixed upload + immediate display + consistent response format + FILE SERVING
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const config = require('../config/config');

// Logger
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`)
};

const backendRoot = path.resolve(__dirname, '..', '..');
const projectRoot = path.resolve(backendRoot, '..');

const configuredDbPath = config?.database?.path || null;
const envDbPath = process.env.DB_PATH
  ? (path.isAbsolute(process.env.DB_PATH)
      ? process.env.DB_PATH
      : path.resolve(backendRoot, process.env.DB_PATH))
  : null;

const LEGACY_DB_PATHS = Array.from(new Set([
  path.join(__dirname, '../../database/documents.db'),
  path.join(__dirname, '../../../storage/database/documents.db'),
  path.join(__dirname, '../database/documents.db'),
  path.join(__dirname, '../models/database.db')
].filter(Boolean)));

const configuredDocumentsDir = config?.storage?.documentsPath || null;
const configuredUploadDir = config?.storage?.uploadPath || null;

// Align upload writes with configured static directories in every environment.
const UPLOAD_PATHS = Array.from(new Set([
  configuredDocumentsDir,
  configuredUploadDir,
  process.env.DOCUMENTS_DIR
    ? (path.isAbsolute(process.env.DOCUMENTS_DIR)
        ? process.env.DOCUMENTS_DIR
        : path.resolve(backendRoot, process.env.DOCUMENTS_DIR))
    : null,
  process.env.UPLOAD_DIR
    ? (path.isAbsolute(process.env.UPLOAD_DIR)
        ? process.env.UPLOAD_DIR
        : path.resolve(backendRoot, process.env.UPLOAD_DIR))
    : null,
  path.join(__dirname, '../documents'),
  path.join(__dirname, '../uploads'),
  path.join(__dirname, '../../uploads/documents'),
  path.join(__dirname, '../../../storage/documents')
].filter(Boolean)));

const RECOVERY_SEARCH_DIRS = Array.from(new Set([
  configuredDocumentsDir,
  configuredUploadDir,
  path.join(backendRoot, 'src', 'documents'),
  path.join(backendRoot, 'documents'),
  path.join(backendRoot, 'uploads'),
  path.join(projectRoot, 'storage', 'documents'),
  path.join(projectRoot, 'storage', 'uploads')
].filter(Boolean)));

// ═══════════════════════════════════════════════════════════════
// STEP 1 FIX: MULTER UPLOAD CONFIGURATION (ALIGNED WITH SERVER.JS)
// ═══════════════════════════════════════════════════════════════

let uploadDir = null;
for (const dir of UPLOAD_PATHS) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    uploadDir = dir;
    console.log(`[DOCUMENTS] Using upload directory: ${uploadDir}`);
    break;
  } catch (e) {
    console.warn(`[DOCUMENTS] Could not use ${dir}:`, e.message);
  }
}

if (!uploadDir) {
  uploadDir = configuredDocumentsDir || path.join(__dirname, '../documents');
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${cleanName}`;
    cb(null, fileName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not supported`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// ═══════════════════════════════════════════════════════════════
// DATABASE HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function findDatabase() {
  // If DB_PATH is explicitly configured, never fall back to legacy paths.
  // Falling back can split auth and documents across different sqlite files.
  if (envDbPath) {
    if (fs.existsSync(envDbPath)) {
      console.log(`[DOCUMENTS] Found configured database at: ${envDbPath}`);
      return envDbPath;
    }

    console.warn(`[DOCUMENTS] Configured DB_PATH not found: ${envDbPath}`);
    return null;
  }

  if (configuredDbPath && fs.existsSync(configuredDbPath)) {
    console.log(`[DOCUMENTS] Found configured database at: ${configuredDbPath}`);
    return configuredDbPath;
  }

  for (const dbPath of LEGACY_DB_PATHS) {
    if (fs.existsSync(dbPath)) {
      console.log(`[DOCUMENTS] Found legacy database at: ${dbPath}`);
      return dbPath;
    }
  }

  console.log('[DOCUMENTS] No database found, will use file system');
  return null;
}

function getDbConnection(dbPath, mode = sqlite3.OPEN_READWRITE) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, mode, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function categorizeFile(filename, fileType) {
  if (['pdf'].includes(fileType)) return 'Research';
  if (['doc', 'docx'].includes(fileType)) return 'Work';
  if (['ppt', 'pptx'].includes(fileType)) return 'Education';
  if (['xls', 'xlsx'].includes(fileType)) return 'Finance';
  if (['txt'].includes(fileType)) return 'Personal';
  return 'Uncategorized';
}

function getRequestBaseUrl(req) {
  const configuredBase = (process.env.PUBLIC_API_BASE_URL || process.env.PUBLIC_BASE_URL || '').trim();
  if (configuredBase) {
    return configuredBase.replace(/\/+$/, '');
  }

  const protoHeader = req?.headers?.['x-forwarded-proto'];
  const hostHeader = req?.headers?.['x-forwarded-host'];

  const proto = String(protoHeader || req?.protocol || 'http')
    .split(',')[0]
    .trim();

  const host = String(hostHeader || req?.get?.('host') || `localhost:${process.env.PORT || 5000}`)
    .split(',')[0]
    .trim();

  return `${proto}://${host}`;
}

function buildDocumentLinks(req, docId, storedName) {
  const baseUrl = getRequestBaseUrl(req);
  const encodedName = encodeURIComponent(storedName || '');

  return {
    file_url: docId ? `${baseUrl}/api/documents/${docId}/file` : null,
    download_url: docId ? `${baseUrl}/api/documents/${docId}/download` : null,
    static_url: `${baseUrl}/documents/${encodedName}`,
  };
}

function getRequesterUserId(req) {
  const id = Number(req?.user?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// ═══════════════════════════════════════════════════════════════
// STEP 1 FIX: UTILITY FUNCTIONS (ALIGNED WITH SERVER.JS)
// ═══════════════════════════════════════════════════════════════

function buildFileUrl(req, category, filename, docId = null) {
  if (!filename) return null;

  const links = buildDocumentLinks(req, docId, filename);
  
  // Option 1: API route for file serving (most reliable)
  if (docId) {
    return links.file_url;
  }
  
  // Option 2: Direct static serving (matches server.js setup)
  return links.static_url;
}

function getMimeType(fileType) {
  const mimeTypes = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  return mimeTypes[fileType] || 'application/octet-stream';
}

function isExistingFile(filePath) {
  if (!filePath) return false;
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function findFileByName(rootDir, fileName, maxDepth = 4) {
  if (!rootDir || !fileName || !fs.existsSync(rootDir)) return null;

  const target = String(fileName).toLowerCase();
  const stack = [{ dir: rootDir, depth: 0 }];

  while (stack.length > 0) {
    const { dir, depth } = stack.pop();
    if (depth > maxDepth) continue;

    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === target) {
        return fullPath;
      }

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        stack.push({ dir: fullPath, depth: depth + 1 });
      }
    }
  }

  return null;
}

function resolveDocumentFilePath(document = {}) {
  if (isExistingFile(document.file_path)) {
    return document.file_path;
  }

  const fileNames = [
    document.stored_name,
    document.file_path ? path.basename(document.file_path) : null,
    document.original_name,
  ].filter(Boolean);

  const directCandidates = [];

  // Recover from old absolute paths after moving the project folder.
  if (document.file_path) {
    const normalized = String(document.file_path).replace(/\//g, '\\');
    const marker = '\\backend\\';
    const idx = normalized.toLowerCase().indexOf(marker);
    if (idx >= 0) {
      const relativeFromBackend = normalized.slice(idx + marker.length);
      if (relativeFromBackend) {
        directCandidates.push(path.join(backendRoot, relativeFromBackend));
      }
    }
  }

  for (const baseDir of RECOVERY_SEARCH_DIRS) {
    for (const fileName of fileNames) {
      directCandidates.push(path.join(baseDir, fileName));

      if (document.main_category) {
        directCandidates.push(path.join(baseDir, document.main_category, fileName));
      }

      if (document.main_category && document.sub_category) {
        directCandidates.push(
          path.join(baseDir, document.main_category, document.sub_category, fileName)
        );
      }
    }
  }

  for (const candidate of directCandidates) {
    if (isExistingFile(candidate)) {
      return candidate;
    }
  }

  for (const fileName of fileNames) {
    for (const baseDir of RECOVERY_SEARCH_DIRS) {
      const found = findFileByName(baseDir, fileName);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

async function updateAccessCount(docId) {
  const dbPath = findDatabase();
  if (dbPath) {
    try {
      const db = await getDbConnection(dbPath);
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE documents SET access_count = access_count + 1, updated_at = ? WHERE id = ?',
          [new Date().toISOString(), docId],
          function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
          }
        );
      });
      db.close();
    } catch (err) {
      console.error('Failed to update access count:', err);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// STEP 1 FIX: UPLOAD ENDPOINT
// ═══════════════════════════════════════════════════════════════

router.post('/upload', upload.single('document'), async (req, res) => {
  console.log('[DOCUMENTS] POST /api/documents/upload called');

  try {
    const userId = getRequesterUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authorized. Please login.' });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { file } = req;
    const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
    const category = categorizeFile(file.originalname, fileExtension);

    const documentData = {
      original_name: file.originalname,
      stored_name: file.filename,
      file_path: file.path,
      file_type: fileExtension,
      file_size: file.size,
      main_category: category,
      is_bookmarked: 0,
      access_count: 0,
      is_deleted: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const dbPath = findDatabase();
    let savedDoc = null;

    if (dbPath) {
      try {
        const db = await getDbConnection(dbPath);
        
        // Insert into database
        const insertQuery = `
          INSERT INTO documents (
            owner_user_id,
            original_name, stored_name, file_path, file_type, file_size, 
            main_category, is_bookmarked, access_count, is_deleted, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const result = await new Promise((resolve, reject) => {
          db.run(insertQuery, [
            userId,
            documentData.original_name,
            documentData.stored_name,
            documentData.file_path,
            documentData.file_type,
            documentData.file_size,
            documentData.main_category,
            documentData.is_bookmarked,
            documentData.access_count,
            documentData.is_deleted,
            documentData.created_at,
            documentData.updated_at
          ], function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
          });
        });

        db.close();

        savedDoc = {
          id: result.id,
          ...documentData
        };

        console.log(`✅ Document saved to database with ID: ${result.id}`);
      } catch (dbError) {
        console.warn('[DOCUMENTS] Database save failed, continuing without DB:', dbError.message);
        savedDoc = {
          id: Date.now(),
          ...documentData
        };
      }
    } else {
      savedDoc = {
        id: Date.now(),
        ...documentData
      };
    }

    const links = buildDocumentLinks(req, savedDoc.id, savedDoc.stored_name);

    // STEP 1 FIX: Return consistent format expected by frontend
    const responseDoc = {
      id: savedDoc.id,
      original_name: savedDoc.original_name,
      file_name: savedDoc.stored_name,
      file_path: savedDoc.file_path,
      file_type: savedDoc.file_type,
      file_size: savedDoc.file_size,
      main_category: savedDoc.main_category,
      sub_category: null,
      keywords: [],
      is_bookmarked: Boolean(savedDoc.is_bookmarked),
      access_count: savedDoc.access_count,
      created_at: savedDoc.created_at,
      updated_at: savedDoc.updated_at,
      file_exists: true,
      // Frontend compatibility fields
      filename: savedDoc.stored_name,
      originalName: savedDoc.original_name,
      category: savedDoc.main_category,
      size: savedDoc.file_size,
      uploadDate: savedDoc.created_at,
      url: buildFileUrl(req, savedDoc.main_category, savedDoc.stored_name, savedDoc.id),
      // Additional URLs for flexibility
      file_url: links.file_url,
      download_url: links.download_url,
      static_url: links.static_url
    };

    console.log('✅ Document uploaded successfully:', responseDoc.original_name);
    console.log('📁 File URLs:', {
      api: responseDoc.file_url,
      static: responseDoc.static_url
    });

    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      data: responseDoc,
      document: responseDoc // Alternate field for compatibility
    });

  } catch (error) {
    console.error('❌ Upload error:', error);

    // Clean up file if anything failed
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to clean up file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Upload failed'
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// STEP 1 FIX: FILE SERVING ROUTES (NEW)
// ═══════════════════════════════════════════════════════════════

// Serve document file by ID
router.get('/:id/file', async (req, res) => {
  const docId = req.params.id;
  const userId = getRequesterUserId(req);
  console.log(`[DOCUMENTS] GET /api/documents/${docId}/file`);

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Not authorized. Please login.' });
  }
  
  const dbPath = findDatabase();
  
  if (dbPath) {
    try {
      const db = await getDbConnection(dbPath);
      
      const doc = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM documents WHERE id = ? AND is_deleted = 0 AND owner_user_id = ?',
          [docId, userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!doc) {
        db.close();
        return res.status(404).json({ success: false, error: 'Document not found' });
      }

      const resolvedPath = resolveDocumentFilePath(doc);
      if (!resolvedPath) {
        db.close();
        console.error(`[DOCUMENTS] File not found on disk: ${doc.file_path}`);
        return res.status(404).json({ success: false, error: 'File not found on disk' });
      }

      if (doc.file_path !== resolvedPath) {
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE documents SET file_path = ?, updated_at = ? WHERE id = ?',
            [resolvedPath, new Date().toISOString(), docId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        }).catch((err) => {
          console.warn('[DOCUMENTS] Could not update recovered file path:', err.message);
        });
      }

      db.close();

      // Set proper headers for inline viewing
      const fileName = doc.original_name || doc.stored_name;
      const mimeType = getMimeType(doc.file_type);
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Stream the file
      const fileStream = fs.createReadStream(resolvedPath);
      
      fileStream.on('error', (err) => {
        console.error(`[DOCUMENTS] File stream error: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Failed to read file' });
        }
      });
      
      fileStream.pipe(res);
      
      // Update access count
      setTimeout(() => {
        updateAccessCount(docId);
      }, 100);

      console.log(`✅ Serving file: ${fileName} (${mimeType})`);

    } catch (error) {
      console.error(`[DOCUMENTS] File serve error:`, error);
      res.status(500).json({ success: false, error: 'Failed to serve file' });
    }
  } else {
    res.status(404).json({ success: false, error: 'Database not found' });
  }
});

// Download document file by ID
router.get('/:id/download', async (req, res) => {
  const docId = req.params.id;
  const userId = getRequesterUserId(req);
  console.log(`[DOCUMENTS] GET /api/documents/${docId}/download`);

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Not authorized. Please login.' });
  }
  
  const dbPath = findDatabase();
  
  if (dbPath) {
    try {
      const db = await getDbConnection(dbPath);
      
      const doc = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM documents WHERE id = ? AND is_deleted = 0 AND owner_user_id = ?',
          [docId, userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!doc) {
        db.close();
        return res.status(404).json({ success: false, error: 'File not found' });
      }

      const resolvedPath = resolveDocumentFilePath(doc);
      if (!resolvedPath) {
        db.close();
        return res.status(404).json({ success: false, error: 'File not found' });
      }

      if (doc.file_path !== resolvedPath) {
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE documents SET file_path = ?, updated_at = ? WHERE id = ?',
            [resolvedPath, new Date().toISOString(), docId],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        }).catch((err) => {
          console.warn('[DOCUMENTS] Could not update recovered file path:', err.message);
        });
      }

      db.close();

      const fileName = doc.original_name || doc.stored_name;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      const fileStream = fs.createReadStream(resolvedPath);
      fileStream.pipe(res);

      console.log(`📥 Download started: ${fileName}`);

    } catch (error) {
      console.error(`[DOCUMENTS] Download error:`, error);
      res.status(500).json({ success: false, error: 'Download failed' });
    }
  } else {
    res.status(404).json({ success: false, error: 'Database not found' });
  }
});

// ═══════════════════════════════════════════════════════════════
// STEP 1 FIX: GET ALL DOCUMENTS (CONSISTENT RESPONSE FORMAT)
// ═══════════════════════════════════════════════════════════════

router.get('/', async (req, res) => {
  console.log('[DOCUMENTS] GET /api/documents called');

  const userId = getRequesterUserId(req);
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Not authorized. Please login.' });
  }

  const dbPath = findDatabase();

  if (dbPath) {
    try {
      const db = await getDbConnection(dbPath, sqlite3.OPEN_READONLY);

      const documents = await new Promise((resolve, reject) => {
        const query = `
          SELECT id, original_name, stored_name, file_path, file_type, file_size, 
                 main_category, sub_category, is_bookmarked, access_count, created_at, updated_at
          FROM documents 
          WHERE is_deleted = 0 AND owner_user_id = ?
          ORDER BY created_at DESC
        `;

        db.all(query, [userId], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      db.close();

      console.log(`[DOCUMENTS] Found ${documents.length} documents in database`);

      // STEP 1 FIX: Map to consistent format expected by frontend
      const mappedDocuments = documents.map(row => {
        const resolvedPath = resolveDocumentFilePath(row);
        const fileExists = Boolean(resolvedPath);
        const links = buildDocumentLinks(req, row.id, row.stored_name);

        return {
          id: row.id,
          original_name: row.original_name,
          file_name: row.stored_name,
          file_path: resolvedPath || row.file_path,
          file_type: row.file_type,
          file_size: row.file_size,
          main_category: row.main_category || 'Uncategorized',
          sub_category: row.sub_category,
          keywords: [],
          is_bookmarked: Boolean(row.is_bookmarked),
          access_count: row.access_count || 0,
          created_at: row.created_at,
          updated_at: row.updated_at,
          file_exists: fileExists,
          // Frontend compatibility fields
          filename: row.stored_name,
          originalName: row.original_name,
          category: row.main_category || 'Uncategorized',
          size: row.file_size,
          uploadDate: row.created_at,
          url: buildFileUrl(req, row.main_category, row.stored_name, row.id),
          // Additional URLs
          file_url: links.file_url,
          download_url: links.download_url,
          static_url: links.static_url
        };
      });

      res.json({
        success: true,
        count: mappedDocuments.length,
        source: 'database',
        data: mappedDocuments, // Primary field expected by App.jsx
        documents: mappedDocuments // Fallback field
      });

    } catch (error) {
      console.error('[DOCUMENTS] Database query error:', error);
      return getDocumentsFromFileSystem(req, res);
    }
  } else {
    return getDocumentsFromFileSystem(req, res);
  }
});

// ═══════════════════════════════════════════════════════════════
// STEP 1 FIX: FILE SYSTEM FALLBACK WITH CONSISTENT FORMAT
// ═══════════════════════════════════════════════════════════════

function getDocumentsFromFileSystem(req, res) {
  console.log('[DOCUMENTS] Using file system fallback');

  const baseUrl = getRequestBaseUrl(req);
  const userId = getRequesterUserId(req);

  if (userId) {
    return res.json({
      success: true,
      count: 0,
      source: 'filesystem',
      message: 'No documents found for this user.',
      data: [],
      documents: [],
    });
  }
  
  const possiblePaths = [
    uploadDir,
    path.join(__dirname, '../documents'),
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../../documents'),
    path.join(__dirname, '../../uploads')
  ];
  
  let allDocuments = [];
  let checkedPaths = [];
  
  for (const dirPath of possiblePaths) {
    checkedPaths.push(dirPath);
    console.log(`[DOCUMENTS] Checking: ${dirPath}`);
    
    if (fs.existsSync(dirPath)) {
      console.log(`[DOCUMENTS] Found directory: ${dirPath}`);
      const documents = getFilesRecursively(dirPath, '', baseUrl);
      allDocuments = allDocuments.concat(documents);
    }
  }
  
  if (allDocuments.length === 0) {
    console.log('[DOCUMENTS] No documents found anywhere');
    return res.json({
      success: true,
      count: 0,
      source: 'filesystem',
      message: 'No documents found. Upload some documents to get started.',
      data: [],
      documents: [],
      checkedPaths: checkedPaths
    });
  }
  
  console.log(`[DOCUMENTS] Returning ${allDocuments.length} documents from file system`);
  
  res.json({
    success: true,
    count: allDocuments.length,
    source: 'filesystem',
    data: allDocuments,
    documents: allDocuments
  });
}

// ═══════════════════════════════════════════════════════════════
// RECURSIVE FILE FINDER (UPDATED FORMAT)
// ═══════════════════════════════════════════════════════════════

function getFilesRecursively(dirPath, relativePath, baseUrl) {
  const documents = [];
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      
      if (item.startsWith('.') || item === 'node_modules') continue;
      
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }
      
      if (stat.isDirectory()) {
        const subDocs = getFilesRecursively(fullPath, path.join(relativePath, item), baseUrl);
        documents.push(...subDocs);
      } else {
        const ext = path.extname(item).toLowerCase();
        if (['.pdf', '.docx', '.doc', '.txt', '.pptx', '.xlsx'].includes(ext)) {
          const pathParts = relativePath.split(path.sep).filter(p => p);
          const category = pathParts.length > 0 ? pathParts[0] : 'Uncategorized';
          const fileType = ext.slice(1);
          const generatedId = Buffer.from(fullPath).toString('base64').substring(0, 12);
          const originalName = item.replace(/^\d+_/, '');

          // STEP 1 FIX: Consistent format matching database structure
          const doc = {
            id: generatedId,
            original_name: originalName,
            file_name: item,
            file_path: fullPath,
            file_type: fileType,
            file_size: stat.size,
            main_category: category,
            sub_category: null,
            keywords: [],
            is_bookmarked: false,
            access_count: 0,
            created_at: stat.birthtime.toISOString(),
            updated_at: stat.mtime.toISOString(),
            file_exists: true,
            // Frontend compatibility fields
            filename: item,
            originalName: originalName,
            category: category,
            size: stat.size,
            uploadDate: stat.birthtime.toISOString(),
            modifiedDate: stat.mtime.toISOString(),
            path: fullPath,
            url: `${baseUrl}/documents/${encodeURIComponent(item)}`,
            // Additional URLs
            static_url: `${baseUrl}/documents/${encodeURIComponent(item)}`
          };

          documents.push(doc);
        }
      }
    }
  } catch (e) {
    console.error(`[DOCUMENTS] Error reading ${dirPath}:`, e.message);
  }
  
  return documents;
}

// ═══════════════════════════════════════════════════════════════
// REMAINING ROUTES (GET INFO, BOOKMARK, DELETE, CATEGORIES)
// ═══════════════════════════════════════════════════════════════

router.get('/:id/info', async (req, res) => {
  const docId = req.params.id;
  const userId = getRequesterUserId(req);
  console.log(`[DOCUMENTS] GET /api/documents/${docId}/info`);

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Not authorized. Please login.' });
  }
  
  const dbPath = findDatabase();
  
  if (dbPath) {
    try {
      const db = await getDbConnection(dbPath, sqlite3.OPEN_READONLY);
      
      const doc = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM documents WHERE id = ? AND is_deleted = 0 AND owner_user_id = ?',
          [docId, userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      db.close();
      
      if (!doc) {
        return res.status(404).json({ 
          success: false, 
          error: 'Document not found' 
        });
      }

      // Check if file exists
      const resolvedPath = resolveDocumentFilePath(doc);
      const fileExists = Boolean(resolvedPath);
      
      res.json({
        success: true,
        file_exists: fileExists,
        data: {
          id: doc.id,
          original_name: doc.original_name,
          file_name: doc.stored_name,
          file_path: resolvedPath || doc.file_path,
          file_type: doc.file_type,
          file_size: doc.file_size,
          main_category: doc.main_category,
          is_bookmarked: Boolean(doc.is_bookmarked),
          access_count: doc.access_count,
          created_at: doc.created_at,
          updated_at: doc.updated_at
        }
      });
    } catch (error) {
      console.error(`[DOCUMENTS] Error fetching document ${docId}:`, error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch document info' 
      });
    }
  } else {
    res.status(404).json({ 
      success: false, 
      error: 'Document not found' 
    });
  }
});

router.put('/:id/bookmark', async (req, res) => {
  const docId = req.params.id;
  const userId = getRequesterUserId(req);
  console.log(`[DOCUMENTS] PUT /api/documents/${docId}/bookmark`);

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Not authorized. Please login.' });
  }
  
  const dbPath = findDatabase();
  
  if (dbPath) {
    try {
      const db = await getDbConnection(dbPath);
      
      const currentDoc = await new Promise((resolve, reject) => {
        db.get(
          'SELECT is_bookmarked FROM documents WHERE id = ? AND is_deleted = 0 AND owner_user_id = ?',
          [docId, userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!currentDoc) {
        db.close();
        return res.status(404).json({ success: false, error: 'Document not found' });
      }

      const newBookmarkStatus = currentDoc.is_bookmarked ? 0 : 1;
      
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE documents SET is_bookmarked = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?',
          [newBookmarkStatus, new Date().toISOString(), docId, userId],
          function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
          }
        );
      });

      db.close();
      
      res.json({
        success: true,
        data: {
          isBookmarked: Boolean(newBookmarkStatus)
        }
      });
    } catch (error) {
      console.error(`[DOCUMENTS] Bookmark error:`, error);
      res.status(500).json({ success: false, error: 'Bookmark failed' });
    }
  } else {
    res.status(404).json({ success: false, error: 'Database not found' });
  }
});

router.delete('/:id', async (req, res) => {
  const docId = req.params.id;
  const userId = getRequesterUserId(req);
  console.log(`[DOCUMENTS] DELETE /api/documents/${docId}`);

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Not authorized. Please login.' });
  }
  
  const dbPath = findDatabase();
  
  if (dbPath) {
    try {
      const db = await getDbConnection(dbPath);
      
      const doc = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM documents WHERE id = ? AND owner_user_id = ?',
          [docId, userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!doc) {
        db.close();
        return res.status(404).json({ success: false, error: 'Document not found' });
      }
      
      const resolvedPath = resolveDocumentFilePath(doc);
      if (resolvedPath && fs.existsSync(resolvedPath)) {
        try {
          fs.unlinkSync(resolvedPath);
          console.log(`[DOCUMENTS] Deleted file: ${resolvedPath}`);
        } catch (e) {
          console.log(`[DOCUMENTS] Could not delete file: ${e.message}`);
        }
      }
      
      await new Promise((resolve, reject) => {
        db.run(
          'DELETE FROM documents WHERE id = ? AND owner_user_id = ?',
          [docId, userId],
          function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
          }
        );
      });

      db.close();
      
      res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error) {
      console.error(`[DOCUMENTS] Delete error:`, error);
      res.status(500).json({ success: false, error: 'Delete failed' });
    }
  } else {
    res.status(404).json({ success: false, error: 'Database not found' });
  }
});

router.get('/meta/categories', async (req, res) => {
  const userId = getRequesterUserId(req);

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Not authorized. Please login.' });
  }

  const dbPath = findDatabase();
  
  if (dbPath) {
    try {
      const db = await getDbConnection(dbPath, sqlite3.OPEN_READONLY);
      
      const categories = await new Promise((resolve, reject) => {
        db.all(
          'SELECT main_category as name, COUNT(*) as count FROM documents WHERE is_deleted = 0 AND owner_user_id = ? GROUP BY main_category',
          [userId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      db.close();
      
      res.json({ 
        success: true, 
        data: categories,
        categories: categories
      });
    } catch (error) {
      console.error('[DOCUMENTS] Categories error:', error);
      res.json({ success: true, data: [], categories: [] });
    }
  } else {
    res.json({ success: true, data: [], categories: [] });
  }
});

module.exports = router;