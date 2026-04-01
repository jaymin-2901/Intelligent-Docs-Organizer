import React, { useState } from 'react';
import {
  FiFile, FiFolder, FiTag, FiStar, FiCopy, FiCheck,
  FiDatabase, FiPercent, FiClock, FiInfo
} from 'react-icons/fi';
import {
  MdPictureAsPdf, MdDescription, MdArticle, MdSlideshow,
  MdTableChart, MdInsertDriveFile
} from 'react-icons/md';

const DocumentDetails = ({ document, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!document) {
    return (
      <div className="details-empty">
        <div className="empty-icon">📋</div>
        <h3>No Document Selected</h3>
        <p>Click on a document to view details</p>
      </div>
    );
  }

  // Format file size
  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown';
    }
  };

  // Shorten file path
  const shortenPath = (fullPath) => {
    if (!fullPath) return 'Unknown location';
    const parts = fullPath.replace(/\\/g, '/').split('/');
    if (parts.length <= 3) return fullPath;
    
    // Show: .../Category/Subcategory/filename
    const fileName = parts[parts.length - 1];
    const subCategory = parts[parts.length - 2];
    const mainCategory = parts[parts.length - 3];
    
    return `.../${mainCategory}/${subCategory}/${fileName}`;
  };

  // Copy path to clipboard
  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(document.file_path || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Get file icon
  const getFileIcon = (type) => {
    const iconStyle = { fontSize: '48px' };
    const fileType = (type || '').toLowerCase();
    
    switch (fileType) {
      case 'pdf':
        return <MdPictureAsPdf style={{ ...iconStyle, color: '#ef4444' }} />;
      case 'doc':
      case 'docx':
        return <MdDescription style={{ ...iconStyle, color: '#3b82f6' }} />;
      case 'txt':
        return <MdArticle style={{ ...iconStyle, color: '#6b7280' }} />;
      case 'ppt':
      case 'pptx':
        return <MdSlideshow style={{ ...iconStyle, color: '#f59e0b' }} />;
      case 'xls':
      case 'xlsx':
        return <MdTableChart style={{ ...iconStyle, color: '#22c55e' }} />;
      default:
        return <MdInsertDriveFile style={{ ...iconStyle, color: '#8b5cf6' }} />;
    }
  };

  // Parse keywords
  const keywords = Array.isArray(document.keywords) 
    ? document.keywords 
    : (typeof document.keywords === 'string' 
        ? JSON.parse(document.keywords || '[]') 
        : []);

  // Get category color
  const getCategoryColor = (category) => {
    const colors = {
      'Education': '#8b5cf6',
      'Finance': '#f59e0b',
      'Personal': '#10b981',
      'Research': '#3b82f6',
      'Work': '#6366f1',
      'Legal': '#ef4444',
      'Medical': '#22c55e',
      'Uncategorized': '#6b7280'
    };
    return colors[category] || '#6b7280';
  };

  // Confidence percentage
  const confidence = Math.round((document.confidence_score || 0) * 100);

  return (
    <div className="document-details">
      {/* Header Card */}
      <div className="details-header-card">
        <div className="file-icon-wrapper">
          {getFileIcon(document.file_type)}
        </div>
        <div className="file-title">
          <h2 title={document.original_name || 'Unknown Document'}>
            {document.original_name || 'Unknown Document'}
          </h2>
          <div className="file-type-badge">
            {(document.file_type || 'FILE').toUpperCase()}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-item">
          <FiDatabase className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{formatSize(document.file_size)}</span>
            <span className="stat-label">Size</span>
          </div>
        </div>
        <div className="stat-item">
          <FiClock className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{formatDate(document.created_at)}</span>
            <span className="stat-label">Added</span>
          </div>
        </div>
        <div className="stat-item">
          <FiStar className="stat-icon" />
          <div className="stat-content">
            <span className="stat-value">{document.access_count || 0}</span>
            <span className="stat-label">Views</span>
          </div>
        </div>
      </div>

      {/* Category Section */}
      <div className="details-section">
        <h3 className="section-title">
          <FiFolder className="section-icon" />
          Classification
        </h3>
        <div className="classification-grid">
          <div className="class-item">
            <span className="class-label">Main Category</span>
            <span 
              className="class-value category-badge"
              style={{ backgroundColor: getCategoryColor(document.main_category) }}
            >
              {document.main_category || 'Uncategorized'}
            </span>
          </div>
          <div className="class-item">
            <span className="class-label">Sub-Category</span>
            <span className="class-value subcategory-badge">
              {document.sub_category || 'General'}
            </span>
          </div>
        </div>
      </div>

      {/* Confidence Score */}
      <div className="details-section">
        <h3 className="section-title">
          <FiPercent className="section-icon" />
          AI Confidence
        </h3>
        <div className="confidence-container">
          <div className="confidence-bar">
            <div 
              className="confidence-fill"
              style={{ 
                width: `${confidence}%`,
                background: confidence > 70 ? '#22c55e' : confidence > 40 ? '#f59e0b' : '#ef4444'
              }}
            />
          </div>
          <span className="confidence-value">{confidence}%</span>
        </div>
        <p className="confidence-hint">
          {confidence > 70 ? 'High confidence classification' : 
           confidence > 40 ? 'Moderate confidence - may need review' : 
           'Low confidence - consider manual categorization'}
        </p>
      </div>

      {/* Keywords Section */}
      {keywords.length > 0 && (
        <div className="details-section">
          <h3 className="section-title">
            <FiTag className="section-icon" />
            Extracted Keywords
          </h3>
          <div className="keywords-container">
            {keywords.map((keyword, index) => (
              <span key={index} className="keyword-chip">
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* File Path Section */}
      <div className="details-section">
        <h3 className="section-title">
          <FiFile className="section-icon" />
          File Location
        </h3>
        <div className="path-container">
          <code className="file-path" title={document.file_path}>
            {shortenPath(document.file_path)}
          </code>
          <button 
            className={`copy-btn ${copied ? 'copied' : ''}`}
            onClick={copyPath}
            title="Copy full path"
          >
            {copied ? <FiCheck /> : <FiCopy />}
          </button>
        </div>
      </div>

      {/* File Info Grid */}
      <div className="details-section">
        <h3 className="section-title">
          <FiInfo className="section-icon" />
          File Information
        </h3>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">Original Name</span>
            <span className="info-value">{document.original_name || 'Unknown'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Stored Name</span>
            <span className="info-value">{document.stored_name || 'Unknown'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">File Type</span>
            <span className="info-value">{(document.file_type || 'Unknown').toUpperCase()}</span>
          </div>
          <div className="info-item">
            <span className="info-label">File Size</span>
            <span className="info-value">{formatSize(document.file_size)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Created</span>
            <span className="info-value">{formatDate(document.created_at)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Last Accessed</span>
            <span className="info-value">{formatDate(document.last_accessed) || 'Never'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentDetails;