const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const categorizationService = require('../services/categorizationService');

// Multer config for temp storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, '../../uploads/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const name = safeName.replace(/\s+/g, '_');
    cb(null, `${timestamp}_${name}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ==================== ROUTES ====================

// Single document upload with AI categorization
router.post('/upload', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    console.log(`[UPLOAD] Processing: ${req.file.originalname}`);

    // Process with categorization service
    const result = await categorizationService.processDocument({
      path: req.file.path,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    res.json({
      success: true,
      message: 'Document uploaded and categorized successfully',
      data: result
    });

  } catch (error) {
    console.error('[UPLOAD ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Upload failed'
    });
  }
});

// Multiple documents upload
router.post('/upload-multiple', upload.array('documents', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    console.log(`[UPLOAD] Processing ${req.files.length} files`);

    const results = [];
    for (const file of req.files) {
      try {
        const result = await categorizationService.processDocument({
          path: file.path,
          originalname: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        });
        results.push(result);
      } catch (err) {
        results.push({
          originalName: file.originalname,
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${results.length} documents`,
      data: results
    });

  } catch (error) {
    console.error('[UPLOAD ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Upload failed'
    });
  }
});

// Get all categories with document counts
router.get('/categories', async (req, res) => {
  try {
    const categories = await categorizationService.getCategories();
    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get documents by category
router.get('/documents', async (req, res) => {
  try {
    const { mainCategory, subCategory } = req.query;
    const documents = await categorizationService.getDocuments(mainCategory, subCategory);
    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get single document
router.get('/documents/:id', async (req, res) => {
  try {
    const document = await categorizationService.getDocument(req.params.id);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Search documents
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query required'
      });
    }
    const documents = await categorizationService.searchDocuments(q);
    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Toggle bookmark
router.put('/documents/:id/bookmark', async (req, res) => {
  try {
    const database = require('../models/database');
    const doc = await database.get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    const newStatus = doc.is_bookmarked ? 0 : 1;
    await database.run('UPDATE documents SET is_bookmarked = ? WHERE id = ?', [newStatus, req.params.id]);

    res.json({
      success: true,
      data: { isBookmarked: !!newStatus }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Delete document
router.delete('/documents/:id', async (req, res) => {
  try {
    const database = require('../models/database');
    const doc = await database.get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Delete file
    if (fs.existsSync(doc.file_path)) {
      fs.unlinkSync(doc.file_path);
    }

    // Soft delete in database
    await database.run('UPDATE documents SET is_deleted = 1 WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: 'Document deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;