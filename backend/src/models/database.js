/**
 * Database Connection and Operations
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const config = require('../config/config');

const logger = {
  info: (msg, meta) => console.log(`[DB-INFO] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[DB-ERROR] ${msg}`, meta || '')
};

class Database {
  constructor() {
    this.db = null;
    this.initialized = false;
  }
  
  async initialize() {
    return new Promise((resolve, reject) => {
      // Ensure database directory exists
      const dbDir = path.dirname(config.database.path);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      this.db = new sqlite3.Database(
        config.database.path,
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        (err) => {
          if (err) {
            logger.error('Database connection failed', err.message);
            reject(err);
          } else {
            logger.info('Database connected successfully');
            this.initialized = true;
            this._createTables()
              .then(() => resolve())
              .catch(reject);
          }
        }
      );
    });
  }
  
  async _createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        file_type TEXT,
        file_hash TEXT,
        main_category TEXT NOT NULL DEFAULT 'Uncategorized',
        sub_category TEXT DEFAULT 'General',
        keywords TEXT,
        summary TEXT,
        confidence_score REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_accessed DATETIME,
        access_count INTEGER DEFAULT 0,
        is_bookmarked INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
        metadata TEXT
      )`,
      
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        parent_id INTEGER,
        document_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES categories(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS keywords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL,
        document_id INTEGER NOT NULL,
        frequency INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE IF NOT EXISTS analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER,
        event_type TEXT NOT NULL,
        event_data TEXT,
        duration_seconds INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
      )`
    ];
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(main_category, sub_category)',
      'CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON keywords(keyword)',
      'CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics(event_type, created_at)'
    ];
    
    for (const sql of tables) {
      await this.run(sql);
    }
    
    for (const sql of indexes) {
      await this.run(sql);
    }
    
    logger.info('Database tables created successfully');
  }
  
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          logger.error('SQL run error', { sql, error: err.message });
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }
  
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          logger.error('SQL get error', { sql, error: err.message });
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
  
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          logger.error('SQL all error', { sql, error: err.message });
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }
  
  async transaction(statements) {
    await this.run('BEGIN TRANSACTION');
    try {
      for (const { sql, params } of statements) {
        await this.run(sql, params);
      }
      await this.run('COMMIT');
    } catch (err) {
      await this.run('ROLLBACK');
      throw err;
    }
  }
  
  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.initialized = false;
            logger.info('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

const database = new Database();

module.exports = database;