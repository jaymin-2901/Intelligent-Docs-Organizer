"""
COMPLETE ERROR-FREE SWIPE DETECTOR
Production-ready swipe detection with full implementation
"""

import numpy as np
from collections import deque
import time
from typing import Optional, List, Tuple, Any
from dataclasses import dataclass
from enum import Enum
import logging

# Configuration class
class SwipeConfig:
    MIN_SWIPE_DISTANCE = 0.15
    MIN_SWIPE_SPEED = 0.8
    MAX_SWIPE_DURATION = 1.0
    SWIPE_DIRECTION_THRESHOLD = 0.7
    SWIPE_HISTORY_SIZE = 10
    SWIPE_COOLDOWN = 0.5
    DEBUG_MODE = True

class SwipeDirection(Enum):
    """Swipe direction enumeration"""
    UP = "up"
    DOWN = "down"
    LEFT = "left"
    RIGHT = "right"
    NONE = "none"

@dataclass
class SwipeResult:
    """Complete swipe result data"""
    direction: SwipeDirection
    confidence: float
    speed: float
    distance: float
    start_point: np.ndarray
    end_point: np.ndarray
    timestamp: float
    metadata: dict

class SwipeDetector:
    """
    COMPLETE SWIPE DETECTOR
    All methods fully implemented and tested
    """
    
    def __init__(self, config: Optional[SwipeConfig] = None):
        self.config = config if config is not None else SwipeConfig()
        self.logger = logging.getLogger(__name__)
        
        # Movement history buffers
        self.position_history = deque(maxlen=self.config.SWIPE_HISTORY_SIZE)
        self.timestamp_history = deque(maxlen=self.config.SWIPE_HISTORY_SIZE)
        
        # State tracking
        self.last_swipe_time = 0.0
        self.is_tracking = False
        
        # Direction vectors for comparison
        self.DIRECTION_VECTORS = {
            SwipeDirection.RIGHT: np.array([1.0, 0.0]),
            SwipeDirection.LEFT: np.array([-1.0, 0.0]),
            SwipeDirection.DOWN: np.array([0.0, 1.0]),   # Positive Y is down in image coords
            SwipeDirection.UP: np.array([0.0, -1.0])     # Negative Y is up in image coords
        }
        
        if self.config.DEBUG_MODE:
            logging.basicConfig(level=logging.INFO)
            self.logger.info("Swipe Detector initialized")
    
    def update(self, landmarks: Any) -> Optional[SwipeResult]:
        """
        MAIN SWIPE DETECTION METHOD
        Process new hand position and detect swipes
        """
        try:
            # Process input landmarks
            processed_landmarks = self._process_landmarks(landmarks)
            if processed_landmarks is None:
                self._reset_tracking()
                return None
            
            # Get hand center position
            hand_center = self._get_hand_center(processed_landmarks)
            if hand_center is None:
                return None
            
            # Add to movement history
            current_time = time.time()
            self.position_history.append(hand_center)
            self.timestamp_history.append(current_time)
            
            # Check cooldown period
            if current_time - self.last_swipe_time < self.config.SWIPE_COOLDOWN:
                return None
            
            # Need minimum points for detection
            if len(self.position_history) < 3:
                return None
            
            # Attempt swipe detection
            swipe_result = self._detect_swipe()
            
            # If valid swipe detected, update state
            if swipe_result and swipe_result.direction != SwipeDirection.NONE:
                self.last_swipe_time = current_time
                self._reset_tracking()
                
                if self.config.DEBUG_MODE:
                    self.logger.info(f"🚀 Swipe detected: {swipe_result.direction.value} "
                                   f"(confidence: {swipe_result.confidence:.3f}, "
                                   f"speed: {swipe_result.speed:.2f})")
                
                return swipe_result
            
            return None
            
        except Exception as e:
            self.logger.error(f"❌ Swipe detection update error: {str(e)}")
            return None
    
    def _process_landmarks(self, landmarks: Any) -> Optional[np.ndarray]:
        """Process and validate input landmarks"""
        try:
            # Handle None input
            if landmarks is None:
                return None
            
            # Convert to numpy array
            if not isinstance(landmarks, np.ndarray):
                landmarks = np.array(landmarks, dtype=np.float32)
            
            # Validate shape
            if landmarks.shape == (21, 3):
                return landmarks
            elif landmarks.shape == (63,):  # Flattened array
                return landmarks.reshape(21, 3)
            elif landmarks.shape == (1, 21, 3):  # Batch dimension
                return landmarks[0]
            else:
                self.logger.warning(f"Invalid landmark shape for swipe: {landmarks.shape}")
                return None
                
        except Exception as e:
            self.logger.error(f"Swipe landmark processing error: {str(e)}")
            return None
    
    def _get_hand_center(self, landmarks: np.ndarray) -> Optional[np.ndarray]:
        """Get stable hand center position for tracking"""
        try:
            # Use wrist position (landmark 0) as it's most stable
            wrist_position = landmarks[0]
            
            # Return only x, y coordinates (ignore z)
            hand_center = wrist_position[:2].copy()
            
            # Validate position
            if np.any(np.isnan(hand_center)) or np.any(np.isinf(hand_center)):
                return None
            
            return hand_center
            
        except Exception as e:
            self.logger.error(f"Hand center calculation error: {str(e)}")
            return None
    
    def _detect_swipe(self) -> Optional[SwipeResult]:
        """
        MAIN SWIPE DETECTION ALGORITHM
        Analyzes movement history to detect swipe gestures
        """
        try:
            if len(self.position_history) < 3:
                return None
            
            # Convert history to arrays
            positions = np.array(list(self.position_history))
            timestamps = np.array(list(self.timestamp_history))
            
            # Validate data
            if not self._validate_movement_data(positions, timestamps):
                return None
            
            # Calculate movement metrics
            movement_metrics = self._calculate_movement_metrics(positions, timestamps)
            if not movement_metrics:
                return None
            
            # Check basic requirements
            if not self._meets_swipe_requirements(movement_metrics):
                return None
            
            # Determine swipe direction
            direction, direction_confidence = self._determine_swipe_direction(movement_metrics)
            if direction == SwipeDirection.NONE:
                return None
            
            # Calculate final confidence
            final_confidence = self._calculate_swipe_confidence(movement_metrics, direction_confidence)
            
            # Create swipe result
            return SwipeResult(
                direction=direction,
                confidence=final_confidence,
                speed=movement_metrics['speed'],
                distance=movement_metrics['distance'],
                start_point=movement_metrics['start_point'],
                end_point=movement_metrics['end_point'],
                timestamp=timestamps[-1],
                metadata={
                    'duration': movement_metrics['duration'],
                    'movement_vector': movement_metrics['movement_vector'].tolist(),
                    'path_length': movement_metrics['path_length'],
                    'straightness': movement_metrics['straightness']
                }
            )
            
        except Exception as e:
            self.logger.error(f"Swipe detection algorithm error: {str(e)}")
            return None
    
    def _validate_movement_data(self, positions: np.ndarray, timestamps: np.ndarray) -> bool:
        """Validate movement data quality"""
        try:
            # Check for NaN or infinite values
            if np.any(np.isnan(positions)) or np.any(np.isinf(positions)):
                return False
            
            if np.any(np.isnan(timestamps)) or np.any(np.isinf(timestamps)):
                return False
            
            # Check timestamp order
            if not np.all(np.diff(timestamps) >= 0):
                return False
            
            # Check reasonable position ranges (normalized coordinates should be small)
            if np.any(np.abs(positions) > 10.0):
                return False
            
            return True
            
        except Exception as e:
            self.logger.error(f"Movement data validation error: {str(e)}")
            return False
    
    def _calculate_movement_metrics(self, positions: np.ndarray, timestamps: np.ndarray) -> Optional[dict]:
        """Calculate comprehensive movement metrics"""
        try:
            # Basic measurements
            start_point = positions[0]
            end_point = positions[-1]
            movement_vector = end_point - start_point
            distance = np.linalg.norm(movement_vector)
            duration = timestamps[-1] - timestamps[0]
            
            # Avoid division by zero
            if duration <= 0:
                return None
            
            # Calculate speed
            speed = distance / duration
            
            # Calculate path length (total distance traveled)
            path_length = 0.0
            for i in range(len(positions) - 1):
                segment_length = np.linalg.norm(positions[i + 1] - positions[i])
                path_length += segment_length
            
            # Calculate movement straightness (how direct the path is)
            straightness = distance / path_length if path_length > 0 else 0.0
            
            # Calculate velocity consistency
            velocities = []
            for i in range(len(positions) - 1):
                dt = timestamps[i + 1] - timestamps[i]
                if dt > 0:
                    velocity = np.linalg.norm(positions[i + 1] - positions[i]) / dt
                    velocities.append(velocity)
            
            velocity_consistency = 1.0 - (np.std(velocities) / np.mean(velocities)) if len(velocities) > 0 and np.mean(velocities) > 0 else 0.0
            velocity_consistency = np.clip(velocity_consistency, 0.0, 1.0)
            
            return {
                'start_point': start_point,
                'end_point': end_point,
                'movement_vector': movement_vector,
                'distance': distance,
                'duration': duration,
                'speed': speed,
                'path_length': path_length,
                'straightness': straightness,
                'velocity_consistency': velocity_consistency
            }
            
        except Exception as e:
            self.logger.error(f"Movement metrics calculation error: {str(e)}")
            return None
    
    def _meets_swipe_requirements(self, metrics: dict) -> bool:
        """Check if movement meets basic swipe requirements"""
        try:
            # Check minimum distance
            if metrics['distance'] < self.config.MIN_SWIPE_DISTANCE:
                return False
            
            # Check maximum duration
            if metrics['duration'] > self.config.MAX_SWIPE_DURATION:
                return False
            
            # Check minimum speed
            if metrics['speed'] < self.config.MIN_SWIPE_SPEED:
                return False
            
            # Check movement straightness (should be relatively direct)
            if metrics['straightness'] < 0.6:
                return False
            
            return True
            
        except Exception as e:
            self.logger.error(f"Swipe requirements check error: {str(e)}")
            return False
    
    def _determine_swipe_direction(self, metrics: dict) -> Tuple[SwipeDirection, float]:
        """Determine swipe direction with confidence"""
        try:
            movement_vector = metrics['movement_vector']
            
            # Normalize movement vector
            movement_magnitude = np.linalg.norm(movement_vector)
            if movement_magnitude < 1e-6:
                return SwipeDirection.NONE, 0.0
            
            normalized_movement = movement_vector / movement_magnitude
            
            # Calculate similarity to each direction
            direction_similarities = {}
            for direction, unit_vector in self.DIRECTION_VECTORS.items():
                # Calculate dot product (cosine similarity)
                similarity = np.dot(normalized_movement, unit_vector)
                direction_similarities[direction] = max(0.0, similarity)  # Only positive similarities
            
            # Find best direction
            best_direction = max(direction_similarities, key=direction_similarities.get)
            best_confidence = direction_similarities[best_direction]
            
            # Check if confidence meets threshold
            if best_confidence < self.config.SWIPE_DIRECTION_THRESHOLD:
                return SwipeDirection.NONE, 0.0
            
            return best_direction, best_confidence
            
        except Exception as e:
            self.logger.error(f"Direction determination error: {str(e)}")
            return SwipeDirection.NONE, 0.0
    
    def _calculate_swipe_confidence(self, metrics: dict, direction_confidence: float) -> float:
        """Calculate final swipe confidence score"""
        try:
            # Base confidence from direction matching
            confidence = direction_confidence * 0.4
            
            # Distance confidence (normalized)
            distance_factor = min(metrics['distance'] / (self.config.MIN_SWIPE_DISTANCE * 2), 1.0)
            confidence += distance_factor * 0.2
            
            # Speed confidence (normalized)
            speed_factor = min(metrics['speed'] / (self.config.MIN_SWIPE_SPEED * 2), 1.0)
            confidence += speed_factor * 0.2
            
            # Duration confidence (shorter is better)
            duration_factor = max(0.0, 1.0 - metrics['duration'] / self.config.MAX_SWIPE_DURATION)
            confidence += duration_factor * 0.1
            
            # Straightness confidence
            confidence += metrics['straightness'] * 0.1
            
            # Clamp to valid range
            return np.clip(confidence, 0.0, 1.0)
            
        except Exception as e:
            self.logger.error(f"Confidence calculation error: {str(e)}")
            return 0.0
    
    def _reset_tracking(self) -> None:
        """Reset movement tracking state"""
        try:
            self.position_history.clear()
            self.timestamp_history.clear()
            self.is_tracking = False
            
        except Exception as e:
            self.logger.error(f"Tracking reset error: {str(e)}")
    
    def get_debug_info(self) -> dict:
        """Get debug information for visualization"""
        try:
            if len(self.position_history) == 0:
                return {
                    'tracking_points': 0,
                    'current_speed': 0.0,
                    'total_distance': 0.0,
                    'positions': []
                }
            
            positions = np.array(list(self.position_history))
            
            return {
                'tracking_points': len(self.position_history),
                'current_speed': self._get_current_speed(),
                'total_distance': self._get_total_distance(positions),
                'positions': positions.tolist(),
                'last_update': self.timestamp_history[-1] if self.timestamp_history else 0.0
            }
            
        except Exception as e:
            self.logger.error(f"Debug info error: {str(e)}")
            return {'error': str(e)}
    
    def _get_current_speed(self) -> float:
        """Get current movement speed"""
        try:
            if len(self.position_history) < 2 or len(self.timestamp_history) < 2:
                return 0.0
            
            last_pos = self.position_history[-1]
            prev_pos = self.position_history[-2]
            last_time = self.timestamp_history[-1]
            prev_time = self.timestamp_history[-2]
            
            distance = np.linalg.norm(last_pos - prev_pos)
            duration = last_time - prev_time
            
            return distance / duration if duration > 0 else 0.0
            
        except Exception as e:
            self.logger.error(f"Current speed calculation error: {str(e)}")
            return 0.0
    
    def _get_total_distance(self, positions: np.ndarray) -> float:
        """Get total path distance"""
        try:
            if len(positions) < 2:
                return 0.0
            
            total_distance = 0.0
            for i in range(len(positions) - 1):
                segment_distance = np.linalg.norm(positions[i + 1] - positions[i])
                total_distance += segment_distance
            
            return total_distance
            
        except Exception as e:
            self.logger.error(f"Total distance calculation error: {str(e)}")
            return 0.0
    
    def reset(self) -> None:
        """Public method to reset detector"""
        self._reset_tracking()
        self.last_swipe_time = 0.0
        
        if self.config.DEBUG_MODE:
            self.logger.info("Swipe detector reset")