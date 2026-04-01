import React, { useState, useRef, useCallback } from 'react';
import './DocumentUpload.css';

function DocumentUpload({ onUpload, className = "", allowMultiple = false }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  // Supported file types
  const supportedTypes = {
    'application/pdf': { ext: '.pdf', icon: '📕', name: 'PDF' },
    'text/plain': { ext: '.txt', icon: '📝', name: 'Text' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', icon: '📘', name: 'Word' },
    'application/msword': { ext: '.doc', icon: '📘', name: 'Word' },
    'text/markdown': { ext: '.md', icon: '📋', name: 'Markdown' },
    'application/json': { ext: '.json', icon: '📊', name: 'JSON' },
    'text/csv': { ext: '.csv', icon: '📈', name: 'CSV' },
    'application/vnd.ms-excel': { ext: '.xls', icon: '📊', name: 'Excel' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: '.xlsx', icon: '📊', name: 'Excel' },
    'image/jpeg': { ext: '.jpg', icon: '🖼️', name: 'JPEG' },
    'image/png': { ext: '.png', icon: '🖼️', name: 'PNG' },
    'image/gif': { ext: '.gif', icon: '🖼️', name: 'GIF' },
    'text/html': { ext: '.html', icon: '🌐', name: 'HTML' },
    'application/rtf': { ext: '.rtf', icon: '📄', name: 'RTF' }
  };

  const maxFileSize = 50 * 1024 * 1024; // 50MB

  const validateFile = (file) => {
    if (!file) return { valid: false, error: 'No file provided' };
    
    if (file.size > maxFileSize) {
      return { 
        valid: false, 
        error: `File size too large. Maximum size is ${(maxFileSize / 1024 / 1024).toFixed(0)}MB` 
      };
    }
    
    if (!supportedTypes[file.type]) {
      return { 
        valid: false, 
        error: `Unsupported file type: ${file.type}. Supported types: ${Object.values(supportedTypes).map(t => t.name).join(', ')}` 
      };
    }
    
    return { valid: true };
  };

  const processFile = async (file) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Create file reader for content extraction
    const reader = new FileReader();
    
    return new Promise((resolve, reject) => {
      reader.onload = async (e) => {
        try {
          let content = '';
          const arrayBuffer = e.target.result;
          
          // Extract content based on file type
          if (file.type === 'text/plain' || file.type === 'text/markdown' || file.type === 'text/html') {
            content = new TextDecoder().decode(arrayBuffer);
          } else if (file.type === 'application/json') {
            content = new TextDecoder().decode(arrayBuffer);
            // Validate JSON
            JSON.parse(content);
          } else if (file.type === 'text/csv') {
            content = new TextDecoder().decode(arrayBuffer);
          } else if (file.type.startsWith('image/')) {
            // For images, we'll store the data URL
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            content = `data:${file.type};base64,${base64}`;
          } else {
            // For other file types (PDF, Word, etc.), store basic info
            content = `Binary file: ${file.name} (${file.type})`;
          }

          // Generate tags based on file type and name
          const tags = generateTags(file);

          // Create document object
          const document = {
            id: Date.now() + Math.random().toString(36).substr(2, 9),
            name: file.name,
            type: file.type,
            size: file.size,
            content: content,
            tags: tags,
            uploadDate: new Date().toISOString(),
            lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString(),
            metadata: {
              originalName: file.name,
              uploadedBy: 'user',
              version: 1,
              checksum: await generateChecksum(arrayBuffer)
            }
          };

          resolve(document);
        } catch (error) {
          reject(new Error(`Failed to process file: ${error.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsArrayBuffer(file);
    });
  };

  const generateTags = (file) => {
    const tags = [];
    
    // Add file type tag
    const typeInfo = supportedTypes[file.type];
    if (typeInfo) {
      tags.push(typeInfo.name.toLowerCase());
    }
    
    // Add size-based tags
    if (file.size < 1024 * 1024) {
      tags.push('small');
    } else if (file.size > 10 * 1024 * 1024) {
      tags.push('large');
    }
    
    // Add date-based tags
    const uploadDate = new Date();
    tags.push(uploadDate.getFullYear().toString());
    tags.push(uploadDate.toLocaleDateString('en-US', { month: 'long' }).toLowerCase());
    
    // Extract tags from filename
    const nameParts = file.name.toLowerCase().split(/[._-]/);
    nameParts.forEach(part => {
      if (part.length > 2 && part.length < 20 && !/^\d+$/.test(part)) {
        tags.push(part);
      }
    });
    
    return [...new Set(tags)]; // Remove duplicates
  };

  const generateChecksum = async (arrayBuffer) => {
    try {
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return 'unknown';
    }
  };

  const simulateProgress = () => {
    return new Promise(resolve => {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
          progress = 100;
          setUploadProgress(progress);
          clearInterval(interval);
          resolve();
        } else {
          setUploadProgress(progress);
        }
      }, 100);
    });
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const fileArray = Array.from(files);
      
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        
        // Simulate upload progress
        await simulateProgress();
        
        // Process the file
        const document = await processFile(file);
        
        // Call the upload handler
        if (onUpload) {
          onUpload(document);
        }
        
        setUploadProgress(100);
        
        // Small delay between files if multiple
        if (fileArray.length > 1 && i < fileArray.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
          setUploadProgress(0);
        }
      }
      
      // Reset after successful upload
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1000);
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileInputChange = (e) => {
    handleFileUpload(e.target.files);
    e.target.value = ''; // Reset input
  };

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounterRef.current++;
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounterRef.current--;
    
    if (dragCounterRef.current <= 0) {
      setIsDragging(false);
      dragCounterRef.current = 0;
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(false);
    dragCounterRef.current = 0;
    
    const files = e.dataTransfer.files;
    handleFileUpload(files);
  }, []);

  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const dismissError = () => {
    setError(null);
  };

  const acceptedTypes = Object.keys(supportedTypes).join(',');

  return (
    <div className={`document-upload ${className}`}>
      <div
        className={`upload-area ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={!isUploading ? openFileDialog : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="file-input"
          accept={acceptedTypes}
          multiple={allowMultiple}
          onChange={handleFileInputChange}
          disabled={isUploading}
        />
        
        <div className="upload-content">
          {isUploading ? (
            <div className="upload-progress">
              <div className="progress-icon">📤</div>
              <div className="progress-text">Uploading...</div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <div className="progress-percent">{Math.round(uploadProgress)}%</div>
            </div>
          ) : isDragging ? (
            <div className="drag-content">
              <div className="drag-icon">📥</div>
              <div className="drag-text">Drop files here</div>
            </div>
          ) : (
            <div className="default-content">
              <div className="upload-icon">📄</div>
              <div className="upload-text">
                <div className="main-text">Click to upload or drag files here</div>
                <div className="sub-text">
                  Supports: PDF, Word, Text, Images, and more (max {(maxFileSize / 1024 / 1024).toFixed(0)}MB)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="upload-error">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-message">{error}</span>
          </div>
          <button className="error-dismiss" onClick={dismissError}>✕</button>
        </div>
      )}

      {/* Supported file types */}
      <div className="supported-types">
        <details>
          <summary>Supported file types</summary>
          <div className="types-grid">
            {Object.values(supportedTypes).map((type, index) => (
              <div key={index} className="type-item">
                <span className="type-icon">{type.icon}</span>
                <span className="type-name">{type.name}</span>
                <span className="type-ext">{type.ext}</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

export default DocumentUpload;