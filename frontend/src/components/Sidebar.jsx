import React from 'react';

const Sidebar = ({ documents, selectedDocument, onDocumentSelect }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h3>📄 Your Documents</h3>
        <span className="doc-count">{documents.length} files</span>
      </div>
      
      <div className="document-list">
        {documents.length === 0 ? (
          <div className="empty-state">
            <p>No documents uploaded yet</p>
            <p className="hint">Upload your first document to get started!</p>
          </div>
        ) : (
          documents.map((doc, index) => (
            <div
              key={index}
              className={`document-item ${selectedDocument === index ? 'selected' : ''}`}
              onClick={() => onDocumentSelect(index)}
            >
              <div className="doc-icon">📄</div>
              <div className="doc-info">
                <h4 className="doc-name">{doc.name}</h4>
                <p className="doc-size">{(doc.size / 1024).toFixed(1)} KB</p>
                <p className="doc-type">{doc.type}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        <button className="btn-secondary btn-small">Clear All</button>
      </div>
    </aside>
  );
};

export default Sidebar;