import React, { useState } from 'react';
import {
  FiMaximize2, FiMinimize2, FiDownload, FiExternalLink, FiX
} from 'react-icons/fi';

const DocumentPreview = ({ document, onClose }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const API_URL = 'http://localhost:5000';

  const getFileUrl = () => {
    if (!document) return null;
    return `${API_URL}/api/files/${document.id}`;
  };

  const toggleFullscreen = () => setIsFullscreen(prev => !prev);

  const downloadFile = () => {
    const url = getFileUrl();
    if (url) {
      window.open(url, '_blank');
    }
  };

  if (!document) {
    return (
      <div className="preview-empty">
        <div className="preview-empty-icon">👁️</div>
        <h3>Document Preview</h3>
        <p>Select a document to preview it here</p>
        <div className="preview-hint">
          <span>📄 PDF files will be displayed inline</span>
          <span>📁 Other files can be downloaded</span>
        </div>
      </div>
    );
  }

  const fileUrl = getFileUrl();
  const isPdf = (document.file_type || '').toLowerCase() === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes((document.file_type || '').toLowerCase());
  const containerClass = isFullscreen ? 'preview-container fullscreen' : 'preview-container';

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="preview-header">
        <div className="preview-title">
          <span className="preview-filename">{document.original_name}</span>
        </div>
        <div className="preview-actions">
          <button className="preview-btn" onClick={downloadFile} title="Open in New Tab">
            <FiExternalLink />
          </button>
          <button className="preview-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
          </button>
          {isFullscreen && (
            <button className="preview-btn close" onClick={onClose}>
              <FiX />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="preview-content">
        {/* PDF Preview using object/embed */}
        {isPdf && fileUrl && (
          <object
            data={fileUrl}
            type="application/pdf"
            className="pdf-object"
          >
            {/* Fallback if PDF viewer not available */}
            <div className="file-placeholder-preview">
              <div className="file-icon-large">📕</div>
              <h3>{document.original_name}</h3>
              <p className="file-type-info">PDF Preview not available in this browser</p>
              <button className="download-btn large" onClick={downloadFile}>
                <FiDownload /> Open PDF in New Tab
              </button>
            </div>
          </object>
        )}

        {/* Image Preview */}
        {isImage && fileUrl && (
          <div className="image-container">
            <img src={fileUrl} alt={document.original_name} className="preview-image" />
          </div>
        )}

        {/* Non-PDF/Non-Image Files */}
        {!isPdf && !isImage && (
          <div className="file-placeholder-preview">
            <div className="file-icon-large">
              {document.file_type === 'docx' || document.file_type === 'doc' ? '📘' :
               document.file_type === 'txt' ? '📝' :
               document.file_type === 'pptx' ? '📊' :
               document.file_type === 'xlsx' ? '📗' : '📄'}
            </div>
            <h3>{document.original_name}</h3>
            <p className="file-type-info">
              {(document.file_type || 'Unknown').toUpperCase()} • Preview not available
            </p>
            <button className="download-btn large" onClick={downloadFile}>
              <FiDownload /> Download to View
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentPreview;