import React, { useState } from 'react';
import './DocumentList.css';

function DocumentList({ 
  documents = [], 
  onDocumentSelect, 
  onDocumentDelete, 
  currentDocument 
}) {
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleDeleteClick = (e, docId) => {
    e.stopPropagation();
    setConfirmDelete(docId);
  };

  const handleConfirmDelete = (e, docId) => {
    e.stopPropagation();
    onDocumentDelete(docId);
    setConfirmDelete(null);
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setConfirmDelete(null);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    try {
      return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getFileIcon = (type) => {
    if (!type) return '📄';
    
    const iconMap = {
      'application/pdf': '📕',
      'text/plain': '📝',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📘',
      'application/msword': '📘',
      'text/markdown': '📋',
      'application/json': '📊',
      'text/csv': '📈',
      'application/vnd.ms-excel': '📊',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
      'image/jpeg': '🖼️',
      'image/png': '🖼️',
      'image/gif': '🖼️',
      'image/svg+xml': '🎨'
    };
    
    return iconMap[type] || '📄';
  };

  if (!documents || documents.length === 0) {
    return (
      <div className="document-list-empty">
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <h3>No Documents</h3>
          <p>Upload your first document to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="document-list">
      <div className="document-list-header">
        <span className="document-count">{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
      </div>
      
      <div className="document-list-items">
        {documents.map((document) => (
          <div
            key={document.id}
            className={`document-item ${currentDocument?.id === document.id ? 'active' : ''}`}
            onClick={() => onDocumentSelect(document)}
          >
            <div className="document-icon">
              {getFileIcon(document.type)}
            </div>
            
            <div className="document-info">
              <div className="document-name" title={document.name}>
                {document.name}
              </div>
              
              <div className="document-meta">
                <span className="document-size">
                  {formatFileSize(document.size)}
                </span>
                <span className="document-date">
                  {formatDate(document.uploadDate || document.lastModified)}
                </span>
              </div>
              
              {document.tags && document.tags.length > 0 && (
                <div className="document-tags">
                  {document.tags.slice(0, 2).map((tag, index) => (
                    <span key={index} className="document-tag">
                      {tag}
                    </span>
                  ))}
                  {document.tags.length > 2 && (
                    <span className="document-tag-more">
                      +{document.tags.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            <div className="document-actions">
              {confirmDelete === document.id ? (
                <div className="delete-confirmation">
                  <button
                    className="confirm-delete-btn"
                    onClick={(e) => handleConfirmDelete(e, document.id)}
                    title="Confirm delete"
                  >
                    ✅
                  </button>
                  <button
                    className="cancel-delete-btn"
                    onClick={handleCancelDelete}
                    title="Cancel delete"
                  >
                    ❌
                  </button>
                </div>
              ) : (
                <button
                  className="delete-btn"
                  onClick={(e) => handleDeleteClick(e, document.id)}
                  title="Delete document"
                >
                  🗑️
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DocumentList;