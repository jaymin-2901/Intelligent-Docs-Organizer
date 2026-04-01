"""
Simplified Gesture Detection without MediaPipe
Uses basic computer vision techniques
"""

import cv2
import numpy as np
import time
import logging
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass

@dataclass
class SimpleDetectionResult:
    gesture: Optional[str]
    confidence: float
    timestamp: float
    debug_info: Dict[str, Any]

class SimpleGestureDetector:
    """
    Simple gesture detection using OpenCV contours
    No MediaPipe dependency required
    """
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.setup_background_subtractor()
        self.gesture_history = []
        self.max_history = 5
        
    def setup_background_subtractor(self):
        """Setup background subtraction for hand detection"""
        self.bg_subtractor = cv2.createBackgroundSubtractorMOG2(
            detectShadows=False,
            varThreshold=50
        )
        
    def detect_gesture(self, frame: np.ndarray) -> Optional[SimpleDetectionResult]:
        """
        Detect gestures using basic computer vision
        """
        try:
            # Convert to HSV for better hand detection
            hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
            
            # Define skin color range
            lower_skin = np.array([0, 20, 70], dtype=np.uint8)
            upper_skin = np.array([20, 255, 255], dtype=np.uint8)
            
            # Create skin mask
            mask = cv2.inRange(hsv, lower_skin, upper_skin)
            
            # Clean up mask
            kernel = np.ones((3, 3), np.uint8)
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
            
            # Find contours
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if not contours:
                return None
            
            # Find largest contour (hand)
            largest_contour = max(contours, key=cv2.contourArea)
            
            if cv2.contourArea(largest_contour) < 5000:  # Minimum hand size
                return None
            
            # Analyze hand shape
            gesture, confidence = self.analyze_contour(largest_contour, frame)
            
            # Add to history for stability
            self.gesture_history.append(gesture)
            if len(self.gesture_history) > self.max_history:
                self.gesture_history.pop(0)
            
            # Get stable gesture
            stable_gesture = self.get_stable_gesture()
            
            return SimpleDetectionResult(
                gesture=stable_gesture,
                confidence=confidence,
                timestamp=time.time(),
                debug_info={
                    'contour_area': int(cv2.contourArea(largest_contour)),
                    'contours_found': len(contours),
                    'history': self.gesture_history.copy()
                }
            )
            
        except Exception as e:
            self.logger.error(f"Gesture detection error: {e}")
            return None
    
    def analyze_contour(self, contour, frame) -> Tuple[str, float]:
        """
        Analyze contour to determine gesture
        """
        try:
            # Calculate contour properties
            area = cv2.contourArea(contour)
            perimeter = cv2.arcLength(contour, True)
            
            if perimeter == 0:
                return "none", 0.0
            
            # Calculate circularity
            circularity = 4 * np.pi * area / (perimeter ** 2)
            
            # Calculate convex hull
            hull = cv2.convexHull(contour)
            hull_area = cv2.contourArea(hull)
            
            # Calculate solidity (how convex the shape is)
            solidity = area / hull_area if hull_area > 0 else 0
            
            # Find convexity defects
            hull_indices = cv2.convexHull(contour, returnPoints=False)
            if len(hull_indices) > 3 and len(contour) > 3:
                defects = cv2.convexityDefects(contour, hull_indices)
                defect_count = len(defects) if defects is not None else 0
            else:
                defect_count = 0
            
            # Calculate bounding rectangle
            x, y, w, h = cv2.boundingRect(contour)
            aspect_ratio = w / h if h > 0 else 0
            
            # Simple gesture classification
            confidence = 0.7  # Base confidence
            
            if circularity > 0.7 and solidity > 0.9:
                return "fist", confidence
            elif defect_count > 4 and solidity < 0.8:
                return "open_palm", confidence
            elif aspect_ratio > 1.5:
                return "thumbs_up", confidence
            elif defect_count >= 2 and defect_count <= 3:
                return "peace", confidence
            else:
                return "none", 0.0
                
        except Exception as e:
            self.logger.error(f"Contour analysis error: {e}")
            return "none", 0.0
    
    def get_stable_gesture(self) -> str:
        """Get stable gesture from history"""
        if not self.gesture_history:
            return "none"
        
        # Count occurrences
        gesture_counts = {}
        for gesture in self.gesture_history:
            gesture_counts[gesture] = gesture_counts.get(gesture, 0) + 1
        
        # Get most common gesture
        most_common = max(gesture_counts, key=gesture_counts.get)
        
        # Require at least 3 occurrences for stability
        if gesture_counts[most_common] >= 3:
            return most_common
        
        return "none"
    
    def draw_debug(self, frame, detection_result):
        """Draw debug information on frame"""
        if not detection_result:
            return frame
        
        debug_frame = frame.copy()
        
        # Draw gesture text
        cv2.putText(debug_frame, f"Gesture: {detection_result.gesture}", (10, 30),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        # Draw confidence
        cv2.putText(debug_frame, f"Confidence: {detection_result.confidence:.2f}", (10, 60),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
        
        # Draw debug info
        debug_info = detection_result.debug_info
        cv2.putText(debug_frame, f"Area: {debug_info.get('contour_area', 0)}", (10, 90),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        return debug_frame