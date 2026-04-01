/**
 * Document Grid Component
 * Displays documents in a grid layout
 */

import React from 'react';
import './DocumentGrid.css';

const DocumentGrid = ({ 
  documents, 
  loading, 
  onSelectDocument,
  onBookmark,
  selectedDocument 
}) => {
  
  if (loading) {
    return (
      <div className="document-grid loading">
        <div className="loading-spinner"></div>
        <p>Loading documents...</p>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="document-grid empty">
        <div className="empty-state">
          <span className="empty-icon">📂</span>
          <h3>No documents found</h3>
          <p>Upload some documents to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="document-grid">
      {documents.map(doc => (
        <div 
          key={doc.id}
          className={`document-card ${selectedDocument?.id === doc.id ? 'selected' : ''}`}
          onClick={() => onSelectDocument(doc)}
        >
          <div className="card-header">
            <span className="file-type-badge">{doc.file_type?.toUpperCase()}</span>
            <button 
              className={`bookmark-btn ${doc.is_bookmarked ? 'bookmarked' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onBookmark(doc.id);
              }}
            >
              {doc.is_bookmarked ? '★' : '☆'}
            </button>
          </div>

          <div className="card-body">
            <div className="file-icon">
              {getFileIcon(doc.file_type)}
            </div>
            <h4 className="file-name" title={doc.original_name}>
              {doc.original_name}
            </h4>
          </div>

          <div className="card-footer">
            <div className="category-badge">
              <span className="main-cat">{doc.main_category}</span>
              {doc.sub_category && (
                <span className="sub-cat">/{doc.sub_category}</span>
              )}
            </div>
            <div className="confidence-score">
              {Math.round(doc.confidence_score * 100)}% match
            </div>
          </div>

          {doc.keywords && doc.keywords.length > 0 && (
            <div className="keywords-list">
              {doc.keywords.slice(0, 3).map((keyword, i) => (
                <span key={i} className="keyword-tag">{keyword}</span>
              ))}
            </div>
          )}

          <div className="card-meta">
            <span>{formatDate(doc.created_at)}</span>
            <span>{formatFileSize(doc.file_size)}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// Helper functions
const getFileIcon = (type) => {
  const icons = {
    'pdf': '📕',
    'docx': '📘',
    'doc': '📘',
    'txt': '📝',
    'pptx': '📊',
    'xlsx': '📗'
  };
  return icons[type] || '📄';
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
};

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

export default DocumentGrid;