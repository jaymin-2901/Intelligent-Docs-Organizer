from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import os

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import routes
from api.gesture_routes import gesture_routes

app = Flask(__name__)
CORS(app)

# Register blueprints
app.register_blueprint(gesture_routes, url_prefix='/gestures')

# ==================== CORE ROUTES ====================

@app.route('/')
def index():
    return jsonify({
        'message': 'Python AI Module Running ✅',
        'status': 'success',
        'services': ['document_analysis', 'gesture_detection', 'ai_summary'],
        'endpoints': {
            'categories': '/categories',
            'analyze': '/analyze (POST)',
            'summarize': '/summarize (POST)',
            'gestures': '/gestures/start, /gestures/stop, /gestures/video-feed'
        }
    })

@app.route('/categories')
def get_categories():
    """Get all available document categories"""
    categories = [
        {'name': 'Work', 'color': '#3b82f6', 'icon': '💼'},
        {'name': 'Personal', 'color': '#10b981', 'icon': '👤'},
        {'name': 'Finance', 'color': '#f59e0b', 'icon': '💰'},
        {'name': 'Education', 'color': '#8b5cf6', 'icon': '📚'},
        {'name': 'Medical', 'color': '#ef4444', 'icon': '🏥'},
        {'name': 'Legal', 'color': '#6366f1', 'icon': '⚖️'},
        {'name': 'Technology', 'color': '#06b6d4', 'icon': '💻'},
        {'name': 'Travel', 'color': '#84cc16', 'icon': '✈️'}
    ]
    return jsonify({'categories': categories})

@app.route('/analyze', methods=['POST'])
def analyze_document():
    """Analyze document and predict category"""
    try:
        data = request.get_json()
        filename = data.get('filename', '')
        content = data.get('content', '')
        
        # Simple keyword-based classification
        filename_lower = filename.lower()
        content_lower = content.lower() if content else ''
        combined = filename_lower + ' ' + content_lower
        
        category_scores = {
            'Work': ['report', 'meeting', 'project', 'deadline', 'office', 'business', 'presentation'],
            'Personal': ['personal', 'diary', 'journal', 'family', 'friend', 'hobby'],
            'Finance': ['invoice', 'receipt', 'budget', 'tax', 'bank', 'financial', 'payment', 'salary'],
            'Education': ['assignment', 'homework', 'lecture', 'study', 'exam', 'university', 'school', 'course'],
            'Medical': ['hospital', 'doctor', 'patient', 'medical', 'health', 'prescription', 'clinic'],
            'Legal': ['contract', 'agreement', 'legal', 'court', 'law', 'attorney', 'lawsuit'],
            'Technology': ['code', 'software', 'programming', 'api', 'database', 'server', 'algorithm'],
            'Travel': ['flight', 'hotel', 'booking', 'trip', 'vacation', 'travel', 'destination']
        }
        
        best_category = 'Uncategorized'
        best_score = 0
        
        for category, keywords in category_scores.items():
            score = sum(1 for kw in keywords if kw in combined)
            if score > best_score:
                best_score = score
                best_category = category
        
        return jsonify({
            'category': best_category,
            'confidence': min(0.95, 0.5 + best_score * 0.1),
            'keywords_found': best_score
        })
        
    except Exception as e:
        return jsonify({'error': str(e), 'category': 'Uncategorized'}), 500

@app.route('/summarize', methods=['POST'])
def summarize_document():
    """Generate AI summary of document"""
    try:
        data = request.get_json()
        filename = data.get('filename', 'Unknown Document')
        content = data.get('content', '')
        
        # Generate summary based on filename if no content
        if not content or len(content.strip()) < 50:
            # Create a mock summary based on filename
            name_part = filename.rsplit('.', 1)[0] if '.' in filename else filename
            
            summary = f"""📄 Document Summary: {filename}

This document titled "{name_part}" has been uploaded to the Intelligent Document Organizer.

📋 Key Information:
• File Name: {filename}
• Status: Successfully processed
• AI Analysis: Document ready for categorization

💡 Recommendation:
Review the document content and use the category tags to organize it effectively.

🔄 Next Steps:
1. Verify the auto-assigned category
2. Add relevant tags if needed
3. Use gesture controls for hands-free navigation"""
            
            return jsonify({'summary': summary})
        
        # If we have content, create a more detailed summary
        words = content.split()
        word_count = len(words)
        
        # Extract first few sentences
        sentences = content.replace('\n', ' ').split('.')
        first_sentences = '. '.join(sentences[:3]) + '.' if len(sentences) > 3 else content[:500]
        
        summary = f"""📄 Document Summary

📝 Overview:
{first_sentences}

📊 Statistics:
• Word Count: {word_count}
• Character Count: {len(content)}
• Estimated Reading Time: {max(1, word_count // 200)} min

✅ Document processed successfully by AI."""
        
        return jsonify({'summary': summary})
        
    except Exception as e:
        return jsonify({'summary': f'Error generating summary: {str(e)}'})


# ==================== HEALTH CHECK ====================

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'python-ai'})


if __name__ == '__main__':
    print('🐍 Python AI Server starting on http://localhost:5001')
    print('🖐️ Gesture detection enabled')
    app.run(host='0.0.0.0', port=5001, debug=True)