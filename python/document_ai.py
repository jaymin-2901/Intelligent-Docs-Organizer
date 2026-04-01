#!/usr/bin/env python3
"""
Intelligent Document AI Engine
- Extracts text from PDF, DOCX, TXT
- Classifies into Main Category
- Generates Sub-Category from topics
- Extracts keywords
"""

import sys
import json
import os
import re
import argparse
from collections import Counter

# Attempt imports
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    from docx import Document
except ImportError:
    Document = None

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

# ==================== CATEGORY DEFINITIONS ====================

CATEGORY_KEYWORDS = {
    'Education': [
        'university', 'college', 'school', 'student', 'teacher', 'education',
        'learning', 'course', 'lecture', 'exam', 'study', 'assignment',
        'thesis', 'dissertation', 'academic', 'professor', 'classroom',
        'curriculum', 'grade', 'degree', 'diploma', 'scholarship',
        'algorithm', 'programming', 'computer science', 'engineering',
        'mathematics', 'physics', 'chemistry', 'biology', 'deep learning',
        'machine learning', 'artificial intelligence', 'neural network',
        'data science', 'python', 'java', 'coding', 'software', 'asd',
        'autism', 'research paper', 'study', 'analysis'
    ],
    'Finance': [
        'finance', 'investment', 'stock', 'market', 'money', 'banking',
        'loan', 'credit', 'debit', 'budget', 'tax', 'audit', 'accounting',
        'profit', 'loss', 'revenue', 'expense', 'invoice', 'balance sheet',
        'asset', 'liability', 'equity', 'dividend', 'portfolio', 'trading',
        'financial', 'economic', 'cryptocurrency', 'bitcoin', 'interest rate'
    ],
    'Personal': [
        'personal', 'diary', 'journal', 'family', 'friend', 'vacation',
        'travel', 'hobby', 'recipe', 'health', 'fitness', 'workout',
        'wedding', 'birthday', 'anniversary', 'memories', 'photo',
        'address', 'contact', 'notes', 'personal identification'
    ],
    'Research': [
        'research', 'hypothesis', 'experiment', 'methodology', 'analysis',
        'conclusion', 'abstract', 'literature review', 'case study',
        'clinical trial', 'survey', 'data collection', 'findings',
        'publication', 'journal', 'citation', 'reference', 'laboratory',
        'scientific', 'theory', 'empirical', 'qualitative', 'quantitative'
    ],
    'Work': [
        'work', 'office', 'meeting', 'project', 'deadline', 'client',
        'business', 'proposal', 'contract', 'report', 'presentation',
        'resume', 'cv', 'cover letter', 'interview', 'hr', 'payroll',
        'employee', 'employer', 'manager', 'team', 'collaboration',
        'strategy', 'marketing', 'sales', 'startup', 'entrepreneur'
    ],
    'Legal': [
        'legal', 'law', 'court', 'attorney', 'lawyer', 'contract',
        'agreement', 'compliance', 'regulation', 'statute', 'lawsuit',
        'plaintiff', 'defendant', 'verdict', 'settlement', 'intellectual',
        'property', 'patent', 'trademark', 'copyright', 'nda', 'affidavit',
        'notary', 'deed', 'will', 'testament', 'lease', 'tenant'
    ],
    'Medical': [
        'medical', 'health', 'hospital', 'doctor', 'patient', 'diagnosis',
        'treatment', 'prescription', 'medicine', 'surgery', 'clinical',
        'symptom', 'disease', 'vaccine', 'pharmacy', 'insurance',
        'laboratory', 'radiology', 'therapy', 'mental health', 'wellness'
    ]
}

STOP_WORDS = set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we',
    'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all',
    'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
    'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'also', 'now', 'here', 'there', 'then', 'once', 'if', 'because',
    'as', 'until', 'while', 'about', 'against', 'between', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off',
    'over', 'under', 'again', 'further', 'any', 'use', 'using', 'used'
])

# ==================== TEXT EXTRACTION ====================

def extract_text_pdf(file_path):
    """Extract text from PDF using PyMuPDF"""
    if not fitz:
        return ""
    text = ""
    try:
        doc = fitz.open(file_path)
        for page in doc:
            text += page.get_text()
        doc.close()
    except Exception as e:
        print(f"PDF Error: {e}", file=sys.stderr)
    return text

def extract_text_docx(file_path):
    """Extract text from DOCX"""
    if not Document:
        return ""
    text = ""
    try:
        doc = Document(file_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    except Exception as e:
        print(f"DOCX Error: {e}", file=sys.stderr)
    return text

def extract_text_txt(file_path):
    """Extract text from TXT"""
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            return f.read()
    except Exception as e:
        print(f"TXT Error: {e}", file=sys.stderr)
    return ""

def extract_text(file_path, file_type):
    """Route to appropriate extractor"""
    file_type = file_type.lower()
    if file_type == 'pdf':
        return extract_text_pdf(file_path)
    elif file_type in ['docx', 'doc']:
        return extract_text_docx(file_path)
    elif file_type == 'txt':
        return extract_text_txt(file_path)
    else:
        return extract_text_txt(file_path)

# ==================== KEYWORD EXTRACTION ====================

def extract_keywords_tfidf(text, top_n=10):
    """Extract keywords using TF-IDF"""
    if not SKLEARN_AVAILABLE or len(text.strip()) < 50:
        return extract_keywords_simple(text, top_n)
    
    try:
        vectorizer = TfidfVectorizer(
            max_features=100,
            stop_words='english',
            ngram_range=(1, 2)
        )
        tfidf_matrix = vectorizer.fit_transform([text])
        feature_names = vectorizer.get_feature_names_out()
        tfidf_scores = tfidf_matrix.toarray()[0]
        
        # Get top keywords
        top_indices = tfidf_scores.argsort()[-top_n:][::-1]
        keywords = [feature_names[i] for i in top_indices if tfidf_scores[i] > 0]
        
        return keywords
    except:
        return extract_keywords_simple(text, top_n)

def extract_keywords_simple(text, top_n=10):
    """Simple keyword extraction as fallback"""
    # Clean text
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    words = text.split()
    
    # Filter stop words and short words
    words = [w for w in words if w not in STOP_WORDS and len(w) > 3]
    
    # Count frequencies
    word_counts = Counter(words)
    
    # Return top keywords
    return [word for word, count in word_counts.most_common(top_n)]

# ==================== CATEGORY CLASSIFICATION ====================

def classify_document(text, keywords):
    """Classify document into main category using keyword matching"""
    text_lower = text.lower()
    scores = {}
    
    for category, cat_keywords in CATEGORY_KEYWORDS.items():
        score = 0
        for keyword in cat_keywords:
            # Count occurrences of keyword in text
            count = text_lower.count(keyword.lower())
            if count > 0:
                score += count
        
        # Bonus for keyword match in extracted keywords
        for kw in keywords:
            if kw.lower() in [k.lower() for k in cat_keywords]:
                score += 5
        
        scores[category] = score
    
    # Get best category
    if not scores or max(scores.values()) == 0:
        return 'Uncategorized', 0.0
    
    best_category = max(scores, key=scores.get)
    total_score = sum(scores.values())
    
    # Calculate confidence (normalized)
    confidence = scores[best_category] / (total_score + 1) if total_score > 0 else 0
    confidence = min(confidence, 1.0)
    
    return best_category, round(confidence, 2)

def generate_sub_category(text, keywords, main_category):
    """Generate sub-category from top keywords"""
    if not keywords:
        return 'General'
    
    # Clean keywords for folder names
    valid_keywords = []
    for kw in keywords[:5]:
        # Skip generic words
        if kw.lower() in ['study', 'analysis', 'report', 'document', 'file', 'data']:
            continue
        # Clean for folder name
        clean_kw = re.sub(r'[^a-zA-Z0-9]', '', kw)
        if len(clean_kw) > 3:
            valid_keywords.append(clean_kw.title())
    
    if not valid_keywords:
        return 'General'
    
    # Use top keyword as sub-category
    sub_cat = valid_keywords[0]
    
    # Special handling for Education
    if main_category == 'Education':
        # Check for specific topics
        text_lower = text.lower()
        if 'deep learning' in text_lower or 'neural network' in text_lower:
            return 'DeepLearning'
        if 'machine learning' in text_lower:
            return 'MachineLearning'
        if 'web' in text_lower and ('development' in text_lower or 'technology' in text_lower):
            return 'WebTechnology'
        if 'asd' in text_lower or 'autism' in text_lower:
            return 'ASD'
        if 'python' in text_lower:
            return 'PythonProgramming'
    
    # Return cleaned sub-category
    return sub_cat

# ==================== MAIN ANALYZER ====================

def analyze_document(file_path, file_type=None):
    """Main analysis function"""
    # Determine file type
    if not file_type:
        file_type = file_path.split('.')[-1].lower()
    
    # Extract text
    text = extract_text(file_path, file_type)
    
    if not text or len(text.strip()) < 10:
        return {
            'success': False,
            'error': 'Could not extract text from document',
            'main_category': 'Uncategorized',
            'sub_category': 'General',
            'keywords': [],
            'confidence_score': 0
        }
    
    # Extract keywords
    keywords = extract_keywords_tfidf(text, top_n=15)
    
    # Classify
    main_category, confidence = classify_document(text, keywords)
    
    # Generate sub-category
    sub_category = generate_sub_category(text, keywords, main_category)
    
    # Calculate overall confidence
    overall_confidence = confidence
    
    return {
        'success': True,
        'main_category': main_category,
        'sub_category': sub_category,
        'keywords': keywords[:10],
        'confidence_score': overall_confidence,
        'word_count': len(text.split()),
        'file_type': file_type
    }

# ==================== CLI ENTRY POINT ====================

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Analyze document')
    parser.add_argument('--file', required=True, help='Path to file')
    parser.add_argument('--type', help='File type (pdf, docx, txt)')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.file):
        print(json.dumps({
            'success': False,
            'error': f'File not found: {args.file}'
        }))
        sys.exit(1)
    
    result = analyze_document(args.file, args.type)
    print(json.dumps(result, indent=2))