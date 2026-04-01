/**
 * Documents Page
 * Main document management interface
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  getDocuments, 
  uploadDocument, 
  searchDocuments, 
  toggleBookmark 
} from '../services/api';
import CategoryTree from '../components/CategoryTree';
import DocumentGrid from '../components/DocumentGrid';
import DocumentViewer from '../components/DocumentViewer';
import './Documents.css';

const Documents = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Fetch documents on mount and category change
  useEffect(() => {
    fetchDocuments();
  }, [selectedCategory]);

  const fetchDocuments = async () => {
    setLoading(true);
    const response = await getDocuments(
      selectedCategory?.main,
      selectedCategory?.sub
    );
    if (response.success) {
      setDocuments(response.data);
    }
    setLoading(false);
  };

  const handleCategorySelect = (mainCategory, subCategory) => {
    setSelectedCategory(
      mainCategory ? { main: mainCategory, sub: subCategory } : null
    );
  };

  const handleDocumentSelect = (doc) => {
    setSelectedDocument(doc);
  };

  const handleBookmark = async (docId) => {
    await toggleBookmark(docId);
    fetchDocuments();
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchDocuments();
      return;
    }

    setLoading(true);
    const response = await searchDocuments(searchQuery);
    if (response.success) {
      setDocuments(response.data);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < files.length; i++) {
      const result = await uploadDocument(files[i]);
      setUploadProgress(((i + 1) / files.length) * 100);
      
      if (result.success) {
        console.log('Uploaded:', result.data);
      }
    }

    setUploading(false);
    setUploadProgress(0);
    fetchDocuments();
  };

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    
    setUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < files.length; i++) {
      const result = await uploadDocument(files[i]);
      setUploadProgress(((i + 1) / files.length) * 100);
    }

    setUploading(false);
    fetchDocuments();
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div 
      className="documents-page"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Sidebar */}
      <aside className="sidebar">
        <CategoryTree 
          onSelectCategory={handleCategorySelect}
          selectedCategory={selectedCategory}
        />
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="content-header">
          <div className="header-left">
            <h1>
              {selectedCategory 
                ? `${selectedCategory.main}${selectedCategory.sub ? ` / ${selectedCategory.sub}` : ''}`
                : 'All Documents'
              }
            </h1>
            <span className="document-count">
              {documents.length} documents
            </span>
          </div>

          <div className="header-right">
            {/* Search */}
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="search-btn">🔍</button>
            </form>

            {/* Upload Button */}
            <label className="upload-btn">
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt,.pptx,.xlsx"
                onChange={handleFileUpload}
                hidden
              />
              <span>📤 Upload</span>
            </label>
          </div>
        </header>

        {/* Upload Progress */}
        {uploading && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span>Processing... {Math.round(uploadProgress)}%</span>
          </div>
        )}

        {/* Document Grid */}
        <DocumentGrid
          documents={documents}
          loading={loading}
          onSelectDocument={handleDocumentSelect}
          onBookmark={handleBookmark}
          selectedDocument={selectedDocument}
        />
      </main>

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <DocumentViewer
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      )}

      {/* Drop Zone Overlay */}
      {uploading && (
        <div className="drop-overlay">
          <div className="drop-content">
            <div className="drop-icon">📤</div>
            <h2>Processing Documents...</h2>
            <p>Please wait while your documents are being categorized</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Documents;