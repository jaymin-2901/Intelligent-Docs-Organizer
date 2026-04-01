/**
 * Document Categorization Service
 */

const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const database = require('../models/database');
const pythonBridge = require('./pythonBridge');
const config = require('../config/config');

const logger = {
  info: (msg, meta) => console.log(`[CAT-INFO] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[CAT-ERROR] ${msg}`, meta || '')
};

class CategorizationService {
  constructor() {
    this.uploadPath = config.storage.uploadPath;
    this.documentsPath = config.storage.documentsPath;
    this.defaultCategory = config.categories.defaultCategory;
    this.defaultSubcategory = config.categories.defaultSubcategory;
  }
  
  async initialize() {
    try {
      await fs.mkdir(this.documentsPath, { recursive: true });
      
      for (const category of config.categories.main) {
        await fs.mkdir(
          path.join(this.documentsPath, category),
          { recursive: true }
        );
      }
      
      logger.info('Categorization service initialized');
    } catch (err) {
      logger.error('Failed to initialize categorization service', err);
      throw err;
    }
  }
  
  async processDocument(file) {
    const startTime = Date.now();
    
    try {
      logger.info(`Processing document: ${file.originalname}`);
      
      const tempPath = file.path;
      const fileType = this.getFileExtension(file.originalname);
      const fileHash = await this.calculateHash(tempPath);
      
      // Check for duplicates
      const existing = await database.get(
        'SELECT * FROM documents WHERE file_hash = ? AND is_deleted = 0',
        [fileHash]
      );
      
      if (existing) {
        logger.info(`Duplicate document found: ${existing.id}`);
        return {
          ...existing,
          keywords: JSON.parse(existing.keywords || '[]'),
          isDuplicate: true
        };
      }
      
      // Send to Python AI
      const aiResult = await pythonBridge.processDocument(tempPath, fileType);
      
      const mainCategory = aiResult.main_category || this.defaultCategory;
      const subCategory = aiResult.sub_category || this.defaultSubcategory;
      const confidenceScore = aiResult.confidence_score || 0;
      
      const suggestedName = aiResult.suggested_filename || 
        path.parse(file.originalname).name;
      
      const { finalPath, finalFilename } = await this.organizeFile(
        tempPath,
        mainCategory,
        subCategory,
        `${suggestedName}.${fileType}`
      );
      
      const docId = await this.saveDocumentRecord({
        originalName: file.originalname,
        storedName: finalFilename,
        filePath: finalPath,
        fileSize: file.size,
        fileType,
        fileHash,
        mainCategory,
        subCategory,
        keywords: aiResult.keywords || [],
        confidenceScore,
        topics: aiResult.topics || [],
        processingTimeMs: Date.now() - startTime,
        wordCount: aiResult.word_count || 0
      });
      
      logger.info(`Document processed: ID ${docId}`);
      
      return {
        id: docId,
        originalName: file.originalname,
        storedName: finalFilename,
        filePath: finalPath,
        mainCategory,
        subCategory,
        keywords: aiResult.keywords || [],
        topics: aiResult.topics || [],
        confidenceScore,
        isDuplicate: false
      };
      
    } catch (error) {
      logger.error('Document processing failed', error);
      throw error;
    }
  }
  
  async calculateHash(filePath) {
    const fileBuffer = await fs.readFile(filePath);
    const hash = crypto.createHash('md5');
    hash.update(fileBuffer);
    return hash.digest('hex');
  }
  
  async organizeFile(tempPath, mainCategory, subCategory, filename) {
    const targetDir = path.join(
      this.documentsPath,
      this.sanitizePath(mainCategory),
      this.sanitizePath(subCategory)
    );
    
    await fs.mkdir(targetDir, { recursive: true });
    
    const sanitizedFilename = this.sanitizeFilename(filename);
    const finalFilename = await this.getUniqueFilename(targetDir, sanitizedFilename);
    const finalPath = path.join(targetDir, finalFilename);
    
    await fs.rename(tempPath, finalPath);
    
    logger.info(`File organized: ${finalPath}`);
    
    return { finalPath, finalFilename };
  }
  
  async saveDocumentRecord(data) {
    const result = await database.run(
      `INSERT INTO documents (
        original_name, stored_name, file_path, file_size, file_type, file_hash,
        main_category, sub_category, keywords, confidence_score, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.originalName,
        data.storedName,
        data.filePath,
        data.fileSize,
        data.fileType,
        data.fileHash,
        data.mainCategory,
        data.subCategory,
        JSON.stringify(data.keywords),
        data.confidenceScore,
        JSON.stringify({
          topics: data.topics,
          processingTimeMs: data.processingTimeMs,
          wordCount: data.wordCount
        })
      ]
    );
    
    await this.saveKeywords(result.id, data.keywords);
    
    return result.id;
  }
  
  async saveKeywords(documentId, keywords) {
    if (!keywords || keywords.length === 0) return;
    
    const statements = keywords.map(keyword => ({
      sql: 'INSERT INTO keywords (keyword, document_id) VALUES (?, ?)',
      params: [keyword.toLowerCase(), documentId]
    }));
    
    await database.transaction(statements);
  }
  
  async getCategories() {
    const categories = await database.all(`
      SELECT 
        main_category as name,
        COUNT(*) as document_count
      FROM documents
      WHERE is_deleted = 0
      GROUP BY main_category
      ORDER BY document_count DESC
    `);
    
    const result = [];
    
    for (const cat of categories) {
      const subCategories = await database.all(`
        SELECT 
          sub_category as name,
          COUNT(*) as document_count
        FROM documents
        WHERE is_deleted = 0 AND main_category = ?
        GROUP BY sub_category
        ORDER BY document_count DESC
      `, [cat.name]);
      
      result.push({
        name: cat.name,
        documentCount: cat.document_count,
        subCategories: subCategories.map(s => ({
          name: s.name,
          documentCount: s.document_count
        }))
      });
    }
    
    return result;
  }
  
  async getDocuments(mainCategory = null, subCategory = null, options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    let sql = `
      SELECT 
        id, original_name, stored_name, file_path, file_size, file_type,
        main_category, sub_category, keywords, confidence_score,
        created_at, last_accessed, access_count, is_bookmarked
      FROM documents
      WHERE is_deleted = 0
    `;
    
    const params = [];
    
    if (mainCategory) {
      sql += ' AND main_category = ?';
      params.push(mainCategory);
    }
    
    if (subCategory) {
      sql += ' AND sub_category = ?';
      params.push(subCategory);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const documents = await database.all(sql, params);
    
    return documents.map(doc => ({
      ...doc,
      keywords: JSON.parse(doc.keywords || '[]')
    }));
  }
  
  async searchDocuments(query) {
    const searchQuery = `%${query.toLowerCase()}%`;
    
    const documents = await database.all(`
      SELECT DISTINCT
        d.id, d.original_name, d.stored_name, d.file_path,
        d.main_category, d.sub_category, d.keywords, d.created_at
      FROM documents d
      LEFT JOIN keywords k ON d.id = k.document_id
      WHERE d.is_deleted = 0
      AND (
        LOWER(d.original_name) LIKE ? OR
        LOWER(k.keyword) LIKE ? OR
        LOWER(d.keywords) LIKE ?
      )
      ORDER BY d.created_at DESC
      LIMIT 20
    `, [searchQuery, searchQuery, searchQuery]);
    
    return documents.map(doc => ({
      ...doc,
      keywords: JSON.parse(doc.keywords || '[]')
    }));
  }
  
  async getDocument(id) {
    const doc = await database.get(
      'SELECT * FROM documents WHERE id = ? AND is_deleted = 0',
      [id]
    );
    
    if (doc) {
      await database.run(
        'UPDATE documents SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );
      
      return {
        ...doc,
        keywords: JSON.parse(doc.keywords || '[]'),
        metadata: JSON.parse(doc.metadata || '{}')
      };
    }
    
    return null;
  }
  
  // Helper methods
  getFileExtension(filename) {
    return path.extname(filename).toLowerCase().substring(1);
  }
  
  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 100);
  }
  
  sanitizePath(component) {
    return component.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 50);
  }
  
  async getUniqueFilename(directory, filename) {
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    let finalName = filename;
    let counter = 1;
    
    while (true) {
      try {
        await fs.access(path.join(directory, finalName));
        finalName = `${baseName}_${counter}${ext}`;
        counter++;
      } catch {
        break;
      }
    }
    
    return finalName;
  }
}

const categorizationService = new CategorizationService();

module.exports = categorizationService;