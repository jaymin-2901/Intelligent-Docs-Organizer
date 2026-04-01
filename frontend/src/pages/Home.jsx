import React, { useState } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import DocumentViewer from '../components/DocumentViewer';
import UploadButton from '../components/UploadButton';
import GestureControl from '../components/GestureControl';

const Home = () => {
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);

  const handleFileUpload = (files) => {
    const newDocuments = files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      file: file
    }));

    setDocuments(prev => [...prev, ...newDocuments]);
    
    // Auto-select the first uploaded document
    if (documents.length === 0) {
      setSelectedDocument(0);
    }
  };

  const handleDocumentSelect = (index) => {
    setSelectedDocument(index);
  };

  return (
    <div className="app">
      <Header />
      
      <div className="main-content">
        <Sidebar 
          documents={documents}
          selectedDocument={selectedDocument}
          onDocumentSelect={handleDocumentSelect}
        />
        
        <div className="content-area">
          {documents.length === 0 && (
            <div className="upload-area">
              <UploadButton onFileUpload={handleFileUpload} />
            </div>
          )}
          
          <DocumentViewer 
            selectedDocument={selectedDocument}
            documents={documents}
          />
          
          {documents.length > 0 && (
            <div className="floating-upload">
              <UploadButton onFileUpload={handleFileUpload} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;