"""
Test both gesture classifier and swipe detector
"""
import numpy as np
import time
from gesture_classifier import GestureClassifier
from swipe_detector import SwipeDetector

def test_gesture_classifier():
    """Test gesture classification"""
    classifier = GestureClassifier()
    
    # Create sample landmarks (21 points, 3D)
    landmarks = np.random.rand(21, 3) * 0.5
    
    result = classifier.detect_gesture(landmarks)
    print(f"Gesture test result: {result.gesture} (confidence: {result.confidence:.3f})")

def test_swipe_detector():
    """Test swipe detection"""
    detector = SwipeDetector()
    
    # Simulate rightward swipe movement
    for i in range(10):
        landmarks = np.random.rand(21, 3) * 0.5
        landmarks[0] = [i * 0.1, 0, 0]  # Move wrist rightward
        
        result = detector.update(landmarks)
        if result:
            print(f"Swipe detected: {result.direction.value} (confidence: {result.confidence:.3f})")
            break
        
        time.sleep(0.1)

if __name__ == "__main__":
    print("Testing Gesture Classifier...")
    test_gesture_classifier()
    
    print("\nTesting Swipe Detector...")
    test_swipe_detector()
    
    print("\n✅ Both modules loaded successfully!")