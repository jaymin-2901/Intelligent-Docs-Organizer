const { spawn } = require('child_process');
const path = require('path');
const config = require('../config/config');

class PythonBridge {
  constructor() {
    this.scriptPath = path.join(__dirname, '../../../python/document_ai.py');
    this.pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
    this.timeout = 60000;
  }
  
  async processDocument(filePath, fileType) {
    return new Promise((resolve, reject) => {
      console.log(`[PYTHON] Processing: ${filePath}`);
      console.log(`[PYTHON] Script: ${this.scriptPath}`);
      
      const args = [
        this.scriptPath,
        '--file', filePath,
        '--type', fileType
      ];
      
      const pythonProcess = spawn(this.pythonCommand, args);
      
      let stdout = '';
      let stderr = '';
      
      const timeoutId = setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Processing timeout'));
      }, this.timeout);
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('[PYTHON STDERR]', data.toString());
      });
      
      pythonProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code !== 0) {
          console.error('[PYTHON] Exit code:', code);
          console.error('[PYTHON] Stderr:', stderr);
          reject(new Error(`Python error: ${stderr}`));
          return;
        }
        
        try {
          // Parse JSON from stdout
          const result = JSON.parse(stdout);
          console.log('[PYTHON] Result:', JSON.stringify(result, null, 2));
          resolve(result);
        } catch (err) {
          console.error('[PYTHON] Parse error:', err);
          console.error('[PYTHON] Raw stdout:', stdout);
          reject(new Error('Invalid Python response'));
        }
      });
      
      pythonProcess.on('error', (err) => {
        clearTimeout(timeoutId);
        console.error('[PYTHON] Process error:', err);
        reject(err);
      });
    });
  }
}

const pythonBridge = new PythonBridge();
module.exports = pythonBridge;