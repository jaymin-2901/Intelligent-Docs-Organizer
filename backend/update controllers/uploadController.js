const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Document = require('../models/Document'); // Your DB model

// ═══════════════════════════════════════════════════════════════
// MULTER CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/documents');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
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
// UPLOAD HANDLER (STEP 1 FIX)
// ═══════════════════════════════════════════════════════════════

const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { file } = req;
    const filePath = file.path;

    // Extract file extension
    const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);

    // Basic categorization based on file type
    let category = 'Uncategorized';
    if (['pdf'].includes(fileExtension)) category = 'Research';
    else if (['doc', 'docx'].includes(fileExtension)) category = 'Work';
    else if (['ppt', 'pptx'].includes(fileExtension)) category = 'Education';
    else if (['xls', 'xlsx'].includes(fileExtension)) category = 'Finance';

    // STEP 1 FIX: Create comprehensive document entry
    const documentData = {
      original_name: file.originalname,
      file_name: file.filename,
      file_path: filePath,
      file_type: fileExtension,
      file_size: file.size,
      main_category: category,
      sub_category: null,
      keywords: [],
      is_bookmarked: false,
      access_count: 0,
      created_at: new Date(),
      updated_at: new Date(),
      // Add metadata for analytics
      upload_session: req.sessionID || 'anonymous',
      mime_type: file.mimetype
    };

    // Save to database
    const savedDoc = await Document.create(documentData);

    // STEP 1 FIX: Return COMPLETE document data
    const responseDoc = {
      id: savedDoc._id || savedDoc.id,
      original_name: savedDoc.original_name,
      file_name: savedDoc.file_name,
      file_path: savedDoc.file_path,
      file_type: savedDoc.file_type,
      file_size: savedDoc.file_size,
      main_category: savedDoc.main_category,
      sub_category: savedDoc.sub_category,
      keywords: savedDoc.keywords,
      is_bookmarked: savedDoc.is_bookmarked,
      access_count: savedDoc.access_count,
      created_at: savedDoc.created_at,
      updated_at: savedDoc.updated_at,
      // Add file existence check
      file_exists: true
    };

    console.log('✅ Document uploaded successfully:', responseDoc.original_name);

    res.status(200).json({
      success: true,
      message: 'Document uploaded successfully',
      data: responseDoc,
      document: responseDoc // Alternate field name for compatibility
    });

  } catch (error) {
    console.error('❌ Upload error:', error);

    // Clean up file if DB save failed
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to clean up file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Upload failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET ALL DOCUMENTS (STEP 1 FIX)
// ═══════════════════════════════════════════════════════════════

const getAllDocuments = async (req, res) => {
  try {
    const documents = await Document.find()
      .sort({ created_at: -1 }) // Newest first
      .lean();

    // STEP 1 FIX: Ensure consistent ID field and check file existence
    const docsWithStatus = await Promise.all(documents.map(async (doc) => {
      let fileExists = true;
      try {
        await fs.access(doc.file_path);
      } catch {
        fileExists = false;
      }

      return {
        id: doc._id || doc.id,
        original_name: doc.original_name,
        file_name: doc.file_name,
        file_path: doc.file_path,
        file_type: doc.file_type,
        file_size: doc.file_size,
        main_category: doc.main_category,
        sub_category: doc.sub_category,
        keywords: doc.keywords || [],
        is_bookmarked: doc.is_bookmarked || false,
        access_count: doc.access_count || 0,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        file_exists: fileExists
      };
    }));

    res.json({
      success: true,
      data: docsWithStatus,
      count: docsWithStatus.length
    });

  } catch (error) {
    console.error('❌ Get documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents'
    });
  }
};

module.exports = {
  upload: upload.single('document'),
  uploadDocument,
  getAllDocuments
};