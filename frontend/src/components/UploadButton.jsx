import React, { useRef, useState } from 'react';
import ApiService from '../services/api';

const UploadButton = ({ onFileUpload, onUploadStart, onUploadEnd }) => {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleButtonClick = () => {
    if (!isUploading) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    if (onUploadStart) onUploadStart();

    try {
      // Upload to backend
      const response = await ApiService.uploadDocuments(files);
      
      // Transform backend response to frontend format
      const uploadedDocs = response.files.map(file => ({
        id: file.id,
        name: file.originalName,
        size: file.size,
        type: file.mimetype,
        filename: file.filename,
        url: file.url,
        uploadDate: file.uploadDate
      }));

      onFileUpload(uploadedDocs);
      
      // Clear input
      event.target.value = '';
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (onUploadEnd) onUploadEnd();
    }
  };

  return (
    <div className="upload-section">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept=".pdf,.doc,.docx,.txt"
        style={{ display: 'none' }}
        disabled={isUploading}
      />
      <button 
        className={`btn-primary upload-btn ${isUploading ? 'uploading' : ''}`}
        onClick={handleButtonClick}
        disabled={isUploading}
      >
        {isUploading ? '⏳ Uploading...' : '📁 Upload Documents'}
      </button>
      <p className="upload-hint">
        Supports: PDF, DOC, DOCX, TXT (Max: 10MB each)
      </p>
    </div>
  );
};

export default UploadButton;