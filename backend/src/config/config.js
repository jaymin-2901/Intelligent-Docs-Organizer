/**
 * Application Configuration
 */

const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const backendRoot = path.resolve(__dirname, '..', '..');
const projectRoot = path.resolve(backendRoot, '..');

const resolveFromBackend = (value, fallbackParts) => {
  if (!value) return path.resolve(...fallbackParts);
  return path.isAbsolute(value) ? value : path.resolve(backendRoot, value);
};

const resolveFromProject = (value, fallbackParts) => {
  if (!value) return path.resolve(...fallbackParts);
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
};

const config = {
  // Server settings
  server: {
    port: process.env.PORT || 5000,
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development'
  },
  
  
  // Database
  database: {
    path: resolveFromBackend(process.env.DB_PATH, [backendRoot, 'database', 'documents.db']),
  },
  
  // File storage
  storage: {
    uploadPath: resolveFromBackend(process.env.UPLOAD_DIR, [backendRoot, 'uploads']),
    documentsPath: resolveFromBackend(process.env.DOCUMENTS_DIR, [backendRoot, 'documents']),
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['pdf', 'docx', 'doc', 'txt', 'pptx', 'xlsx']
  },
  
  // Python AI Engine
  pythonEngine: {
    scriptPath: resolveFromProject(process.env.PYTHON_PATH, [projectRoot, 'python', 'document_ai.py']),
    pythonCommand: process.env.PYTHON_COMMAND || (process.platform === 'win32' ? 'python' : 'python3'),
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