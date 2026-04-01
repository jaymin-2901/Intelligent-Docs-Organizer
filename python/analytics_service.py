# python/analytics_service.py

from flask import Flask, request, jsonify
from flask_cors import CORS
from collections import Counter
import re

app = Flask(__name__)
CORS(app)

# Simple keyword extraction for topics
TOPIC_KEYWORDS = {
    'Programming': ['code', 'algorithm', 'function', 'class', 'variable', 'loop', 'api'],
    'Mathematics': ['equation', 'formula', 'calculate', 'theorem', 'proof', 'integral'],
    'Science': ['experiment', 'hypothesis', 'theory', 'molecule', 'reaction', 'physics'],
    'Business': ['market', 'revenue', 'strategy', 'finance', 'investment', 'profit'],
    'Education': ['learning', 'teaching', 'curriculum', 'student', 'syllabus', 'exam'],
    'Technology': ['software', 'hardware', 'system', 'network', 'database', 'cloud'],
}

def extract_topics(documents):
    """Extract topics from document filenames and categories"""
    topics = Counter()
    
    for doc in documents:
        filename = doc.get('filename', '').lower()
        category = doc.get('category', '').lower()
        
        for topic, keywords in TOPIC_KEYWORDS.items():
            for keyword in keywords:
                if keyword in filename or keyword in category:
                    topics[topic] += 1
                    
    return dict(topics.most_common(5))

def analyze_weak_areas(documents):
    """Identify areas with low engagement"""
    category_views = Counter()
    category_counts = Counter()
    
    for doc in documents:
        category = doc.get('category', 'Uncategorized')
        views = doc.get('view_count', 0)
        category_views[category] += views
        category_counts[category] += 1
    
    weak_areas = []
    for category in category_counts:
        avg_views = category_views[category] / max(category_counts[category], 1)
        if avg_views < 2:  # Low engagement threshold
            weak_areas.append({
                'category': category,
                'avg_views': round(avg_views, 1),
                'document_count': category_counts[category]
            })
    
    return weak_areas

def generate_recommendations(documents, weak_areas):
    """Generate smart recommendations"""
    recommendations = []
    
    if weak_areas:
        recommendations.append(
            f"Focus more on {weak_areas[0]['category']} documents - "
            f"they have low engagement"
        )
    
    total_docs = len(documents)
    if total_docs < 10:
        recommendations.append(
            "Upload more documents to unlock deeper insights and patterns"
        )
    
    categories = set(doc.get('category') for doc in documents if doc.get('category'))
    if len(categories) < 3:
        recommendations.append(
            "Diversify your document categories for better organization"
        )
    
    return recommendations

@app.route('/analyze-insights', methods=['POST'])
def analyze_insights():
    """Main endpoint for AI insights"""
    try:
        data = request.get_json()
        documents = data.get('documents', [])
        
        if not documents:
            return jsonify({
                'insights': ['No documents to analyze yet'],
                'recommendations': ['Upload some documents to get started!'],
                'weakAreas': [],
                'strengths': [],
                'topics': []
            })
        
        # Generate insights
        topics = extract_topics(documents)
        weak_areas = analyze_weak_areas(documents)
        recommendations = generate_recommendations(documents, weak_areas)
        
        # Calculate insights
        total_views = sum(doc.get('view_count', 0) for doc in documents)
        avg_views = total_views / max(len(documents), 1)
        
        insights = [
            f"You have {len(documents)} documents across {len(set(d.get('category') for d in documents))} categories",
            f"Average {round(avg_views, 1)} views per document",
            f"Total document views: {total_views}"
        ]
        
        # Find strengths (most engaged category)
        category_engagement = Counter()
        for doc in documents:
            category_engagement[doc.get('category')] += doc.get('view_count', 0)
        
        strengths = [cat for cat, _ in category_engagement.most_common(3)]
        
        return jsonify({
            'insights': insights,
            'recommendations': recommendations,
            'weakAreas': weak_areas,
            'strengths': strengths,
            'topics': topics
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'insights': ['Error analyzing documents'],
            'recommendations': [],
            'weakAreas': [],
            'strengths': []
        }), 500

if __name__ == '__main__':
    print("Analytics AI Service running on port 5001")
    app.run(port=5001, debug=True)