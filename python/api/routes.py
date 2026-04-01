from flask import Blueprint, request, jsonify
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.document_processor import DocumentProcessor
from utils.text_analyzer import TextAnalyzer
from utils.deadline_extractor import DeadlineExtractor

analysis_routes = Blueprint('analysis', __name__)

# Initialize processors
doc_processor = DocumentProcessor()
text_analyzer = TextAnalyzer()
deadline_extractor = DeadlineExtractor()

@analysis_routes.route('/analyze', methods=['POST'])
def analyze_document():
    """Full document analysis"""
    try:
        data = request.json
        file_path = data.get('file_path')
        
        if not file_path or not os.path.exists(file_path):
            return jsonify({
                'success': False,
                'error': 'File not found'
            }), 404
        
        # Extract text
        text = doc_processor.extract_text(file_path)
        
        # Analyze text
        analysis = text_analyzer.analyze(text)
        
        # Extract deadlines
        deadlines = deadline_extractor.extract(text)
        
        return jsonify({
            'success': True,
            'analysis': {
                'summary': analysis.get('summary', ''),
                'keywords': analysis.get('keywords', []),
                'word_count': analysis.get('word_count', 0),
                'readability': analysis.get('readability', {}),
                'deadlines': deadlines,
                'document_type': analysis.get('document_type', 'unknown')
            }
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@analysis_routes.route('/extract-text', methods=['POST'])
def extract_text():
    """Extract text from document"""
    try:
        data = request.json
        file_path = data.get('file_path')
        
        if not file_path or not os.path.exists(file_path):
            return jsonify({
                'success': False,
                'error': 'File not found'
            }), 404
        
        text = doc_processor.extract_text(file_path)
        
        return jsonify({
            'success': True,
            'text': text,
            'char_count': len(text)
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@analysis_routes.route('/find-dates', methods=['POST'])
def find_dates():
    """Extract important dates from document"""
    try:
        data = request.json
        file_path = data.get('file_path')
        
        if not file_path or not os.path.exists(file_path):
            return jsonify({
                'success': False,
                'error': 'File not found'
            }), 404
        
        text = doc_processor.extract_text(file_path)
        dates = deadline_extractor.extract(text)
        
        return jsonify({
            'success': True,
            'dates': dates
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@analysis_routes.route('/summarize', methods=['POST'])
def summarize():
    """Generate document summary"""
    try:
        data = request.json
        file_path = data.get('file_path')
        sentences = data.get('sentences', 3)
        
        if not file_path or not os.path.exists(file_path):
            return jsonify({
                'success': False,
                'error': 'File not found'
            }), 404
        
        text = doc_processor.extract_text(file_path)
        summary = text_analyzer.summarize(text, num_sentences=sentences)
        
        return jsonify({
            'success': True,
            'summary': summary
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500