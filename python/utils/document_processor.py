import os
import re

class DocumentProcessor:
    """Extract text from various document formats"""
    
    def __init__(self):
        self.supported_formats = ['.pdf', '.txt', '.doc', '.docx']
    
    def extract_text(self, file_path):
        """Extract text from document based on file type"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == '.pdf':
            return self._extract_from_pdf(file_path)
        elif ext == '.txt':
            return self._extract_from_txt(file_path)
        elif ext in ['.doc', '.docx']:
            return self._extract_from_doc(file_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")
    
    def _extract_from_pdf(self, file_path):
        """Extract text from PDF using PyPDF2 or pdfplumber"""
        text = ""
        
        # Try pdfplumber first (better extraction)
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            if text.strip():
                return self._clean_text(text)
        except ImportError:
            pass
        except Exception as e:
            print(f"pdfplumber error: {e}")
        
        # Fallback to PyPDF2
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(file_path)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        except ImportError:
            # If no PDF library, use OCR
            return self._ocr_fallback(file_path)
        except Exception as e:
            print(f"PyPDF2 error: {e}")
            return self._ocr_fallback(file_path)
        
        return self._clean_text(text)
    
    def _extract_from_txt(self, file_path):
        """Extract text from plain text file"""
        encodings = ['utf-8', 'latin-1', 'cp1252']
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    return self._clean_text(f.read())
            except UnicodeDecodeError:
                continue
        
        raise ValueError("Could not decode text file")
    
    def _extract_from_doc(self, file_path):
        """Extract text from Word document"""
        text = ""
        
        try:
            import docx
            doc = docx.Document(file_path)
            for para in doc.paragraphs:
                text += para.text + "\n"
            return self._clean_text(text)
        except ImportError:
            pass
        except Exception as e:
            print(f"python-docx error: {e}")
        
        # Try antiword for .doc files (Linux/Mac only)
        try:
            import subprocess
            result = subprocess.run(['antiword', file_path], 
                                    capture_output=True, text=True)
            if result.returncode == 0:
                return self._clean_text(result.stdout)
        except:
            pass
        
        return text if text else "Could not extract text from DOC file"
    
    def _ocr_fallback(self, file_path):
        """Use OCR as fallback for image-based PDFs"""
        try:
            import pytesseract
            from pdf2image import convert_from_path
            
            images = convert_from_path(file_path)
            text = ""
            
            for image in images:
                text += pytesseract.image_to_string(image) + "\n"
            
            return self._clean_text(text)
            
        except ImportError:
            return "OCR libraries not installed. Install pytesseract and pdf2image."
        except Exception as e:
            return f"OCR failed: {str(e)}"
    
    def _clean_text(self, text):
        """Clean extracted text"""
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove strange characters
        text = re.sub(r'[^\x00-\x7F]+', ' ', text)
        return text.strip()