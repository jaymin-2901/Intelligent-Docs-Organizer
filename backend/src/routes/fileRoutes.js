const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const DOCUMENTS_DIR = path.join(__dirname, '../../documents');

/**
 * Serve file by ID (fallback if static serving fails)
 */
router.get('/files/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const database = require('../models/database');
    
    console.log(`[FILES] Serving file ID: ${id}`);
    
    const doc = await database.get(
      'SELECT * FROM documents WHERE id = ? AND is_deleted = 0',
      [id]
    );
    
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }
    
    if (!doc.file_path || !fs.existsSync(doc.file_path)) {
      return res.status(404).json({
        success: false,
        message: 'File not found on disk',
        path: doc.file_path
      });
    }
    
    // Update access count
    try {
      await database.run(
        'UPDATE documents SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
    } catch (e) {}
    
    // Determine content type
    const contentTypes = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif'
    };
    
    const fileType = (doc.file_type || 'bin').toLowerCase();
    const contentType = contentTypes[fileType] || 'application/octet-stream';
    
    // Set headers for PDF viewing
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_name)}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Stream file
    const fileStream = fs.createReadStream(doc.file_path);
    fileStream.pipe(res);
    
    fileStream.on('error', (err) => {
      console.error('[FILES] Stream error:', err);
    });
    
  } catch (error) {
    console.error('[FILES] Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;