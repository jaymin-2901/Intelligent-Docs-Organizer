"""
PRODUCTION-READY STABILITY FILTER
Provides gesture smoothing, debouncing, and confidence stabilization
"""

import numpy as np
from collections import deque
import time
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
import logging
from gesture_classifier import GestureResult
from swipe_detector import SwipeResult, SwipeDirection

@dataclass
class FilteredGestureResult:
    """Filtered and stabilized gesture result"""
    gesture: str
    confidence: float
    is_stable: bool
    raw_confidence: float
    smoothed_confidence: float
    detection_count: int
    timestamp: float
    metadata: Dict[str, Any]

class StabilityFilter:
    """
    ENTERPRISE-GRADE STABILITY FILTER
    Eliminates noise and false positives from gesture detection
    """
    
    def __init__(self, 
                 smoothing_window: int = 5,
                 min_stable_frames: int = 3,
                 confidence_threshold: float = 0.7,
                 debounce_time: float = 1.0):
        
        self.smoothing_window = smoothing_window
        self.min_stable_frames = min_stable_frames
        self.confidence_threshold = confidence_threshold
        self.debounce_time = debounce_time
        
        # History buffers
        self.gesture_history = deque(maxlen=smoothing_window)
        self.confidence_history = deque(maxlen=smoothing_window)
        self.timestamp_history = deque(maxlen=smoothing_window)
        
        # State tracking
        self.last_stable_gesture = "none"
        self.last_gesture_time = 0.0
        self.current_gesture_count = 0
        self.gesture_start_time = 0.0
        
        # Swipe debouncing
        self.last_swipe_time = 0.0
        self.last_swipe_direction = SwipeDirection.NONE
        
        self.logger = logging.getLogger(__name__)
        self.logger.info("Stability Filter initialized")
    
    def filter_gesture(self, gesture_result: GestureResult) -> Optional[FilteredGestureResult]:
        """
        Filter and stabilize gesture detection
        
        Args:
            gesture_result: Raw gesture detection result
            
        Returns:
            Filtered result if stable, None otherwise
        """
        try:
            current_time = time.time()
            
            # Add to history
            self.gesture_history.append(gesture_result.gesture)
            self.confidence_history.append(gesture_result.confidence)
            self.timestamp_history.append(current_time)
            
            # Apply smoothing
            smoothed_confidence = self._smooth_confidence()
            
            # Check gesture stability
            is_stable, detection_count = self._check_gesture_stability(gesture_result.gesture)
            
            # Apply debouncing
            if not self._check_debounce(gesture_result.gesture, current_time):
                return None
            
            # Create filtered result
            filtered_result = FilteredGestureResult(
                gesture=gesture_result.gesture,
                confidence=smoothed_confidence,
                is_stable=is_stable,
                raw_confidence=gesture_result.confidence,
                smoothed_confidence=smoothed_confidence,
                detection_count=detection_count,
                timestamp=current_time,
                metadata={
                    'raw_metadata': gesture_result.metadata,
                    'filter_info': {
                        'history_length': len(self.gesture_history),
                        'stable_threshold_met': is_stable,
                        'debounce_passed': True
                    }
                }
            )
            
            # Update state if gesture is stable and confident
            if is_stable and smoothed_confidence >= self.confidence_threshold:
                self.last_stable_gesture = gesture_result.gesture
                self.last_gesture_time = current_time
                
                self.logger.info(f"🎯 Stable gesture: {gesture_result.gesture} "
                               f"(conf: {smoothed_confidence:.3f}, count: {detection_count})")
                
                return filtered_result
            
            return None
            
        except Exception as e:
            self.logger.error(f"Gesture filtering error: {str(e)}")
            return None
    
    def filter_swipe(self, swipe_result: SwipeResult) -> Optional[SwipeResult]:
        """
        Filter and debounce swipe detection
        
        Args:
            swipe_result: Raw swipe detection result
            
        Returns:
            Filtered swipe if valid, None otherwise
        """
        try:
            current_time = time.time()
            
            # Check swipe debouncing
            if (current_time - self.last_swipe_time < self.debounce_time and 
                swipe_result.direction == self.last_swipe_direction):
                return None
            
            # Additional validation
            if not self._validate_swipe(swipe_result):
                return None
            
            # Update swipe state
            self.last_swipe_time = current_time
            self.last_swipe_direction = swipe_result.direction
            
            self.logger.info(f"🚀 Stable swipe: {swipe_result.direction.value} "
                           f"(conf: {swipe_result.confidence:.3f})")
            
            return swipe_result
            
        except Exception as e:
            self.logger.error(f"Swipe filtering error: {str(e)}")
            return None
    
    def _smooth_confidence(self) -> float:
        """Apply confidence smoothing using exponential moving average"""
        try:
            if len(self.confidence_history) == 0:
                return 0.0
            
            # Simple moving average for now
            confidences = list(self.confidence_history)
            
            # Apply exponential moving average
            alpha = 0.3  # Smoothing factor
            smoothed = confidences[0]
            
            for conf in confidences[1:]:
                smoothed = alpha * conf + (1 - alpha) * smoothed
            
            return smoothed
            
        except Exception as e:
            self.logger.error(f"Confidence smoothing error: {str(e)}")
            return 0.0
    
    def _check_gesture_stability(self, current_gesture: str) -> tuple:
        """Check if gesture is stable across multiple frames"""
        try:
            if len(self.gesture_history) < self.min_stable_frames:
                return False, 0
            
            # Count recent occurrences of current gesture
            recent_gestures = list(self.gesture_history)[-self.min_stable_frames:]
            gesture_count = recent_gestures.count(current_gesture)
            
            # Gesture is stable if it appears in majority of recent frames
            is_stable = gesture_count >= self.min_stable_frames - 1
            
            return is_stable, gesture_count
            
        except Exception as e:
            self.logger.error(f"Stability check error: {str(e)}")
            return False, 0
    
    def _check_debounce(self, gesture: str, current_time: float) -> bool:
        """Check gesture debouncing to prevent rapid triggering"""
        try:
            # Allow "none" gesture always
            if gesture == "none":
                return True
            
            # Check if enough time has passed since last gesture
            if current_time - self.last_gesture_time < self.debounce_time:
                # Same gesture within debounce period - allow
                if gesture == self.last_stable_gesture:
                    return False
                # Different gesture - check if it's been stable long enough
                return True
            
            return True
            
        except Exception as e:
            self.logger.error(f"Debounce check error: {str(e)}")
            return False
    
    def _validate_swipe(self, swipe_result: SwipeResult) -> bool:
        """Additional swipe validation"""
        try:
            # Check minimum confidence
            if swipe_result.confidence < 0.6:
                return False
            
            # Check reasonable speed and distance
            if swipe_result.speed < 0.5 or swipe_result.distance < 0.1:
                return False
            
            return True
            
        except Exception as e:
            self.logger.error(f"Swipe validation error: {str(e)}")
            return False
    
    def reset(self):
        """Reset filter state"""
        try:
            self.gesture_history.clear()
            self.confidence_history.clear()
            self.timestamp_history.clear()
            
            self.last_stable_gesture = "none"
            self.last_gesture_time = 0.0
            self.current_gesture_count = 0
            self.gesture_start_time = 0.0
            
            self.last_swipe_time = 0.0
            self.last_swipe_direction = SwipeDirection.NONE
            
            self.logger.info("Stability filter reset")
            
        except Exception as e:
            self.logger.error(f"Filter reset error: {str(e)}")
    
    def get_debug_info(self) -> Dict[str, Any]:
        """Get debug information"""
        try:
            return {
                'gesture_history': list(self.gesture_history),
                'confidence_history': list(self.confidence_history),
                'last_stable_gesture': self.last_stable_gesture,
                'time_since_last_gesture': time.time() - self.last_gesture_time,
                'history_length': len(self.gesture_history)
            }
            
        except Exception as e:
            self.logger.error(f"Debug info error: {str(e)}")
            return {'error': str(e)}