/**
 * Centralized Logging System
 */

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

class Logger {
  constructor(name) {
    this.name = name;
    this.logFile = path.join(LOG_DIR, `${name}.log`);
  }
  
  _getTimestamp() {
    return new Date().toISOString();
  }
  
  _formatMessage(level, message, meta = null) {
    const timestamp = this._getTimestamp();
    let logLine = `[${timestamp}] [${level}] [${this.name}] ${message}`;
    if (meta) {
      logLine += ` | ${JSON.stringify(meta)}`;
    }
    return logLine;
  }
  
  _writeToFile(message) {
    fs.appendFile(this.logFile, message + '\n', (err) => {
      if (err) console.error('Log write error:', err);
    });
  }
  
  error(message, meta = null) {
    const formatted = this._formatMessage('ERROR', message, meta);
    console.error('\x1b[31m%s\x1b[0m', formatted);
    this._writeToFile(formatted);
  }
  
  warn(message, meta = null) {
    const formatted = this._formatMessage('WARN', message, meta);
    console.warn('\x1b[33m%s\x1b[0m', formatted);
    this._writeToFile(formatted);
  }
  
  info(message, meta = null) {
    const formatted = this._formatMessage('INFO', message, meta);
    console.info('\x1b[36m%s\x1b[0m', formatted);
    this._writeToFile(formatted);
  }
  
  debug(message, meta = null) {
    if (process.env.NODE_ENV === 'development') {
      const formatted = this._formatMessage('DEBUG', message, meta);
      console.log('\x1b[90m%s\x1b[0m', formatted);
    }
  }
}

const createLogger = (name) => new Logger(name);

module.exports = { Logger, createLogger };