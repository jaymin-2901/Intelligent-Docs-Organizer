/**
 * Application Configuration
 */

const path = require('path');

const config = {
  // Server settings
  server: {
    port: process.env.PORT || 5000,
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development'
  },
  
  
  // Database
  database: {
    path: path.join(__dirname, '../../database/documents.db'),
  },
  
  // File storage
  storage: {
    uploadPath: path.join(__dirname, '../uploads/'),
    documentsPath: path.join(__dirname, '../documents/'),
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['pdf', 'docx', 'doc', 'txt', 'pptx', 'xlsx']
  },
  
  // Python AI Engine
  pythonEngine: {
    scriptPath: path.join(__dirname, '../../../python/document_ai.py'),
    pythonCommand: process.platform === 'win32' ? 'python' : 'python3',
    timeout: 60000
  },
  
  // Categories
  categories: {
    main: ['Education', 'Finance', 'Personal', 'Research', 'Work', 'Legal'],
    defaultCategory: 'Uncategorized',
    defaultSubcategory: 'General'
  }
};

module.exports = config;