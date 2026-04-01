import re
from collections import Counter
import string

class TextAnalyzer:
    """Analyze document text and extract insights"""
    
    def __init__(self):
        # Common English stopwords
        self.stopwords = set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
            'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
            'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why'
        ])
    
    def analyze(self, text):
        """Perform comprehensive text analysis"""
        if not text:
            return {'error': 'No text provided'}
        
        return {
            'summary': self.summarize(text),
            'keywords': self.extract_keywords(text),
            'word_count': self.count_words(text),
            'readability': self.calculate_readability(text),
            'document_type': self.detect_document_type(text)
        }
    
    def summarize(self, text, num_sentences=3):
        """Generate a simple extractive summary"""
        sentences = self._split_sentences(text)
        
        if len(sentences) <= num_sentences:
            return text
        
        # Score sentences based on word frequency
        word_freq = self._get_word_frequency(text)
        sentence_scores = {}
        
        for i, sentence in enumerate(sentences):
            words = self._tokenize(sentence)
            score = sum(word_freq.get(word.lower(), 0) for word in words)
            # Boost first and last sentences
            if i == 0 or i == len(sentences) - 1:
                score *= 1.5
            sentence_scores[i] = score
        
        # Get top sentences
        top_indices = sorted(sentence_scores.keys(), 
                            key=lambda x: sentence_scores[x], 
                            reverse=True)[:num_sentences]
        top_indices.sort()  # Maintain original order
        
        summary = ' '.join(sentences[i] for i in top_indices)
        return summary
    
    def extract_keywords(self, text, num_keywords=10):
        """Extract most important keywords"""
        words = self._tokenize(text)
        
        # Filter out stopwords and short words
        filtered_words = [
            word.lower() for word in words 
            if word.lower() not in self.stopwords 
            and len(word) > 2
            and word not in string.punctuation
        ]
        
        # Count word frequency
        word_counts = Counter(filtered_words)
        
        # Return top keywords
        keywords = word_counts.most_common(num_keywords)
        return [word for word, count in keywords]
    
    def count_words(self, text):
        """Count words in text"""
        words = self._tokenize(text)
        return len(words)
    
    def calculate_readability(self, text):
        """Calculate basic readability metrics"""
        words = self._tokenize(text)
        sentences = self._split_sentences(text)
        syllables = sum(self._count_syllables(word) for word in words)
        
        word_count = len(words)
        sentence_count = max(len(sentences), 1)
        avg_word_length = sum(len(w) for w in words) / max(word_count, 1)
        
        # Flesch Reading Ease (simplified)
        if word_count > 0:
            flesch = 206.835 - 1.015 * (word_count / sentence_count) - 84.6 * (syllables / word_count)
            flesch = max(0, min(100, flesch))
        else:
            flesch = 0
        
        return {
            'flesch_ease': round(flesch, 2),
            'avg_word_length': round(avg_word_length, 2),
            'avg_sentence_length': round(word_count / sentence_count, 2)
        }
    
    def detect_document_type(self, text):
        """Detect the type of document"""
        text_lower = text.lower()
        
        patterns = {
            'syllabus': [r'syllabus', r'course\s+description', r'learning\s+objectives', r'grading\s+policy'],
            'exam': [r'exam', r'test', r'questions?', r'marks', r'time\s+allowed'],
            'assignment': [r'assignment', r'homework', r'due\s+date', r'submit'],
            'research_paper': [r'abstract', r'methodology', r'references', r'conclusion'],
            'resume': [r'experience', r'education', r'skills', r'objective'],
            'contract': [r'agreement', r'party', r'terms', r'conditions', r'contract'],
        }
        
        scores = {}
        for doc_type, pattern_list in patterns.items():
            score = sum(len(re.findall(p, text_lower)) for p in pattern_list)
            scores[doc_type] = score
        
        if scores:
            best_match = max(scores.items(), key=lambda x: x[1])[0]
        else:
            best_match = "Unknown"
        return best_match if scores.get(best_match, 0) > 0 else 'general'
    
    def _split_sentences(self, text):
        """Split text into sentences"""
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]
    
    def _tokenize(self, text):
        """Tokenize text into words"""
        words = re.findall(r'\b\w+\b', text)
        return words
    
    def _get_word_frequency(self, text):
        """Calculate word frequency"""
        words = self._tokenize(text)
        freq = Counter(word.lower() for word in words 
                      if word.lower() not in self.stopwords)
        return dict(freq)
    
    def _count_syllables(self, word):
        """Estimate syllable count"""
        word = word.lower()
        vowels = 'aeiouy'
        count = 0
        prev_is_vowel = False
        
        for char in word:
            is_vowel = char in vowels
            if is_vowel and not prev_is_vowel:
                count += 1
            prev_is_vowel = is_vowel
        
        # Adjust for silent e
        if word.endswith('e'):
            count -= 1
        
        return max(count, 1)