const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

// Import database (adjust path based on your structure)
const database = require('../models/database');

// Promisify fs functions for better async handling
const access = promisify(fs.access);
const stat = promisify(fs.stat);

console.log('[DOCUMENT-ROUTES] Loading document routes...');

// ==================== UTILITY FUNCTIONS ====================




/**
 * Validate document ID parameter
 */
const validateDocumentId = (id) => {
  const documentId = parseInt(id);
  if (isNaN(documentId) || documentId <= 0) {
    throw new Error('Invalid document ID');
  }
  return documentId;
};

/**
 * Get document by ID with error handling
 */
const getDocumentById = async (id) => {
  try {
    const document = await database.get('SELECT * FROM documents WHERE id = ?', [id]);
    return document;
  } catch (error) {
    console.error(`[DOCUMENT-ROUTES] Database error for ID ${id}:`, error);
    throw new Error('Database query failed');
  }
};

/**
 * Check if file exists and get stats
 */
const checkFileExists = async (filePath) => {
  try {
    await access(filePath, fs.constants.F_OK);
    const stats = await stat(filePath);
    return { exists: true, stats };
  } catch (error) {
    return { exists: false, stats: null };
  }
};

/**
 * Update document access tracking
 */
const updateAccessCount = async (id) => {
  try {
    await database.run(
      'UPDATE documents SET access_count = access_count + 1, last_accessed = datetime("now", "localtime") WHERE id = ?',
      [id]
    );
    console.log(`[DOCUMENT-ROUTES] Access count updated for document ${id}`);
  } catch (error) {
    console.warn(`[DOCUMENT-ROUTES] Failed to update access count for ${id}:`, error.message);
  }
};

// ==================== DOCUMENT MANAGEMENT ROUTES ====================

/**
 * GET /api/documents
 * Get all documents with optional filtering
 */
router.get('/documents', async (req, res) => {
  try {
    console.log('[DOCUMENT-ROUTES] GET /api/documents');
    
    const { category, search, bookmarked, limit = 100, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM documents WHERE 1=1';
    const params = [];
    
    // Add filters
    if (category && category !== 'all') {
      query += ' AND main_category = ?';
      params.push(category);
    }
    
    if (search) {
      query += ' AND (original_name LIKE ? OR keywords LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (bookmarked === 'true') {
      query += ' AND is_bookmarked = 1';
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const documents = await database.all(query, params);
    
    // Parse keywords from string to array if needed
    const processedDocuments = documents.map(doc => ({
      ...doc,
      keywords: typeof doc.keywords === 'string' ? 
        (doc.keywords ? JSON.parse(doc.keywords) : []) : 
        (doc.keywords || [])
    }));
    
    res.json({
      success: true,
      data: processedDocuments,
      total: processedDocuments.length
    });
    
  } catch (error) {
    console.error('[DOCUMENT-ROUTES] Get documents error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/:id
 * Get single document by ID
 */
router.get('/documents/:id', async (req, res) => {
  try {
    const documentId = validateDocumentId(req.params.id);
    console.log(`[DOCUMENT-ROUTES] GET /api/documents/${documentId}`);
    
    const document = await getDocumentById(documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }
    
    // Parse keywords if they're stored as JSON string
    if (document.keywords && typeof document.keywords === 'string') {
      try {
        document.keywords = JSON.parse(document.keywords);
      } catch (e) {
        document.keywords = [];
      }
    }
    
    res.json({
      success: true,
      data: document
    });
    
  } catch (error) {
    console.error('[DOCUMENT-ROUTES] Get document error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete document and its file
 */
router.delete('/documents/:id', async (req, res) => {
  try {
    const documentId = validateDocumentId(req.params.id);
    console.log(`[DOCUMENT-ROUTES] DELETE /api/documents/${documentId}`);
    
    const document = await getDocumentById(documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }
    
    // Delete file from disk if it exists
    if (document.file_path) {
      const { exists } = await checkFileExists(document.file_path);
      if (exists) {
        try {
          fs.unlinkSync(document.file_path);
          console.log(`[DOCUMENT-ROUTES] File deleted: ${document.file_path}`);
        } catch (fileError) {
          console.warn(`[DOCUMENT-ROUTES] Could not delete file: ${fileError.message}`);
        }
      }
    }
    
    // Delete from database
    await database.run('DELETE FROM documents WHERE id = ?', [documentId]);
    
    console.log(`[DOCUMENT-ROUTES] Document ${documentId} deleted successfully`);
    
    res.json({
      success: true,
      message: 'Document deleted successfully',
      data: { id: documentId }
    });
    
  } catch (error) {
    console.error('[DOCUMENT-ROUTES] Delete document error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== FILE SERVING ROUTES ====================

/**
 * GET /api/documents/:id/info
 * Get detailed document information including file status
 */
router.get('/documents/:id/info', async (req, res) => {
  try {
    const documentId = validateDocumentId(req.params.id);
    console.log(`[DOCUMENT-ROUTES] GET /api/documents/${documentId}/info`);
    
    const document = await getDocumentById(documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found"
      });
    }

    // Check file status
    const fileCheck = await checkFileExists(document.file_path);
    
    // Parse keywords
    let keywords = [];
    if (document.keywords) {
      try {
        keywords = typeof document.keywords === 'string' ? 
          JSON.parse(document.keywords) : document.keywords;
      } catch (e) {
        keywords = [];
      }
    }

    const result = {
      success: true,
      data: {
        ...document,
        keywords,
        file_exists: fileCheck.exists,
        file_size_actual: fileCheck.stats ? fileCheck.stats.size : null,
        file_modified: fileCheck.stats ? fileCheck.stats.mtime : null,
        access_url: `http://localhost:${process.env.PORT || 5000}/api/documents/${documentId}/file`,
        download_url: `http://localhost:${process.env.PORT || 5000}/api/documents/${documentId}/download`
      }
    };

    console.log(`[DOCUMENT-ROUTES] Document ${documentId} info - File exists: ${fileCheck.exists}`);
    res.json(result);

  } catch (error) {
    console.error('[DOCUMENT-ROUTES] Get info error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/:id/file
 * Serve document file for viewing (inline)
 */
router.get('/documents/:id/file', async (req, res) => {
  try {
    const documentId = validateDocumentId(req.params.id);
    console.log(`[DOCUMENT-ROUTES] GET /api/documents/${documentId}/file`);

    const document = await getDocumentById(documentId);

    if (!document) {
      console.log(`[DOCUMENT-ROUTES] Document ${documentId} not found in database`);
      return res.status(404).json({
        success: false,
        error: "Document not found in database"
      });
    }

    console.log(`[DOCUMENT-ROUTES] Found document: ${document.original_name}`);
    console.log(`[DOCUMENT-ROUTES] File path: ${document.file_path}`);

    // Check if file exists
    const fileCheck = await checkFileExists(document.file_path);
    
    if (!fileCheck.exists) {
      console.log(`[DOCUMENT-ROUTES] File not found on disk: ${document.file_path}`);
      return res.status(404).json({
        success: false,
        error: "File not found on disk",
        path: document.file_path,
        exists: false
      });
    }

    // Update access count asynchronously
    updateAccessCount(documentId).catch(console.warn);

    // Determine content type
    const fileExtension = (document.file_type || 'pdf').toLowerCase();
    const contentTypeMap = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'txt': 'text/plain',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };
    
    const contentType = contentTypeMap[fileExtension] || 'application/octet-stream';

    // Set response headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${document.original_name}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Length', fileCheck.stats.size);

    console.log(`[DOCUMENT-ROUTES] Serving file: ${document.original_name} (${contentType}, ${fileCheck.stats.size} bytes)`);

    // Handle range requests for large files
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileCheck.stats.size - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileCheck.stats.size}`);
      res.setHeader('Content-Length', chunksize);
      
      const fileStream = fs.createReadStream(document.file_path, { start, end });
      fileStream.pipe(res);
    } else {
      // Stream the entire file
      const fileStream = fs.createReadStream(document.file_path);
      
      fileStream.on('error', (err) => {
        console.error(`[DOCUMENT-ROUTES] Stream error:`, err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Error reading file'
          });
        }
      });

      fileStream.on('end', () => {
        console.log(`[DOCUMENT-ROUTES] Successfully served: ${document.original_name}`);
      });

      fileStream.pipe(res);
    }

  } catch (error) {
    console.error('[DOCUMENT-ROUTES] File serve error:', error);
    if (!res.headersSent) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
});

/**
 * GET /api/documents/:id/download
 * Download document file (attachment)
 */
router.get('/documents/:id/download', async (req, res) => {
  try {
    const documentId = validateDocumentId(req.params.id);
    console.log(`[DOCUMENT-ROUTES] GET /api/documents/${documentId}/download`);

    const document = await getDocumentById(documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found"
      });
    }

    const fileCheck = await checkFileExists(document.file_path);
    
    if (!fileCheck.exists) {
      return res.status(404).json({
        success: false,
        error: "File not found on disk",
        path: document.file_path
      });
    }

    // Update access count asynchronously
    updateAccessCount(documentId).catch(console.warn);

    console.log(`[DOCUMENT-ROUTES] Downloading: ${document.original_name}`);

    // Use express download method
    res.download(document.file_path, document.original_name, (err) => {
      if (err) {
        console.error(`[DOCUMENT-ROUTES] Download error:`, err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Download failed'
          });
        }
      } else {
        console.log(`[DOCUMENT-ROUTES] Successfully downloaded: ${document.original_name}`);
      }
    });

  } catch (error) {
    console.error('[DOCUMENT-ROUTES] Download error:', error);
    if (!res.headersSent) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
});

// ==================== DOCUMENT ACTIONS ====================

/**
 * PUT /api/documents/:id/bookmark
 * Toggle bookmark status
 */
router.put('/documents/:id/bookmark', async (req, res) => {
  try {
    const documentId = validateDocumentId(req.params.id);
    console.log(`[DOCUMENT-ROUTES] PUT /api/documents/${documentId}/bookmark`);

    const document = await database.get('SELECT is_bookmarked FROM documents WHERE id = ?', [documentId]);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found"
      });
    }

    const newBookmarkStatus = document.is_bookmarked ? 0 : 1;

    await database.run('UPDATE documents SET is_bookmarked = ? WHERE id = ?', [newBookmarkStatus, documentId]);

    console.log(`[DOCUMENT-ROUTES] Document ${documentId} bookmark: ${newBookmarkStatus === 1 ? 'added' : 'removed'}`);

    res.json({
      success: true,
      data: {
        id: documentId,
        isBookmarked: newBookmarkStatus === 1
      }
    });

  } catch (error) {
    console.error('[DOCUMENT-ROUTES] Bookmark error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/documents/:id/category
 * Update document category
 */
router.put('/documents/:id/category', async (req, res) => {
  try {
    const documentId = validateDocumentId(req.params.id);
    const { main_category, sub_category } = req.body;
    
    console.log(`[DOCUMENT-ROUTES] PUT /api/documents/${documentId}/category`);

    if (!main_category) {
      return res.status(400).json({
        success: false,
        error: "Main category is required"
      });
    }

    const document = await getDocumentById(documentId);
    
    if (!document) {
      return res.status(404).json({
        success: false,
        error: "Document not found"
      });
    }

    await database.run(
      'UPDATE documents SET main_category = ?, sub_category = ? WHERE id = ?',
      [main_category, sub_category || 'General', documentId]
    );

    console.log(`[DOCUMENT-ROUTES] Document ${documentId} category updated: ${main_category}/${sub_category || 'General'}`);

    res.json({
      success: true,
      data: {
        id: documentId,
        main_category,
        sub_category: sub_category || 'General'
      }
    });

  } catch (error) {
    console.error('[DOCUMENT-ROUTES] Update category error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ==================== ANALYTICS ROUTES ====================

/**
 * GET /api/documents/stats
 * Get document statistics
 */
router.get('/documents/stats', async (req, res) => {
  try {
    console.log('[DOCUMENT-ROUTES] GET /api/documents/stats');

    const totalDocs = await database.get('SELECT COUNT(*) as count FROM documents');
    const bookmarkedDocs = await database.get('SELECT COUNT(*) as count FROM documents WHERE is_bookmarked = 1');
    const categoryCounts = await database.all('SELECT main_category, COUNT(*) as count FROM documents GROUP BY main_category');
    const recentDocs = await database.all('SELECT * FROM documents ORDER BY created_at DESC LIMIT 5');
    const mostAccessed = await database.all('SELECT * FROM documents ORDER BY access_count DESC LIMIT 5');

    res.json({
      success: true,
      data: {
        total_documents: totalDocs.count,
        bookmarked_documents: bookmarkedDocs.count,
        categories: categoryCounts,
        recent_documents: recentDocs,
        most_accessed: mostAccessed
      }
    });

  } catch (error) {
    console.error('[DOCUMENT-ROUTES] Stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handler middleware for this router
router.use((error, req, res, next) => {
  console.error('[DOCUMENT-ROUTES] Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

console.log('[DOCUMENT-ROUTES] Document routes loaded successfully ✓');

module.exports = router;