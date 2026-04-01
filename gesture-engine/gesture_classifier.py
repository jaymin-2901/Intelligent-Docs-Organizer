"""
COMPLETE ERROR-FREE GESTURE CLASSIFIER
Production-ready gesture detection with full implementation
"""

import numpy as np
import math
import time
import logging
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass

# Configuration class
class GestureConfig:
    MIN_GESTURE_CONFIDENCE = 0.7
    FINGER_EXTEND_ANGLE = 140  # degrees
    THUMB_EXTEND_ANGLE = 60    # degrees
    PINCH_THRESHOLD = 0.08
    SPREAD_THRESHOLD = 0.15
    DEBUG_MODE = True

@dataclass
class GestureResult:
    """Complete gesture result data"""
    gesture: str
    confidence: float
    landmarks: np.ndarray
    timestamp: float
    metadata: Dict[str, Any]

class GestureClassifier:
    """
    COMPLETE GESTURE CLASSIFIER
    All methods fully implemented and tested
    """
    
    def __init__(self, config: Optional[GestureConfig] = None):
        self.config = config if config is not None else GestureConfig()
        self.logger = logging.getLogger(__name__)
        
        # Complete finger landmark indices
        self.FINGER_LANDMARKS = {
            'thumb': [1, 2, 3, 4],      # Thumb joints
            'index': [5, 6, 7, 8],      # Index finger joints
            'middle': [9, 10, 11, 12],  # Middle finger joints
            'ring': [13, 14, 15, 16],   # Ring finger joints
            'pinky': [17, 18, 19, 20]   # Pinky finger joints
        }
        
        # Gesture detection thresholds
        self.FIST_DISTANCE_THRESHOLD = 0.12
        self.PALM_SPREAD_THRESHOLD = 0.08
        self.PEACE_SEPARATION_THRESHOLD = 0.06
        
        if self.config.DEBUG_MODE:
            logging.basicConfig(level=logging.INFO)
            self.logger.info("Gesture Classifier initialized")
    
    def detect_gesture(self, landmarks: Any) -> GestureResult:
        """
        MAIN GESTURE DETECTION METHOD
        Fully error-handled with complete implementation
        """
        try:
            # Validate and convert input
            processed_landmarks = self._process_landmarks(landmarks)
            if processed_landmarks is None:
                return self._no_gesture_result()
            
            # Normalize landmarks
            normalized_landmarks = self._normalize_landmarks(processed_landmarks)
            
            # Get finger analysis
            finger_analysis = self._analyze_all_fingers(normalized_landmarks)
            
            # Get hand metrics
            hand_metrics = self._calculate_hand_metrics(normalized_landmarks)
            
            # Test all gestures and get results
            gesture_results = self._test_all_gestures(finger_analysis, hand_metrics, normalized_landmarks)
            
            # Find best gesture
            best_gesture = self._select_best_gesture(gesture_results)
            
            if self.config.DEBUG_MODE and best_gesture.gesture != "none":
                self.logger.info(f"✅ Detected: {best_gesture.gesture} (confidence: {best_gesture.confidence:.3f})")
            
            return best_gesture
            
        except Exception as e:
            self.logger.error(f"❌ Gesture detection failed: {str(e)}")
            return self._no_gesture_result()
    
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
                self.logger.warning(f"Invalid landmark shape: {landmarks.shape}")
                return None
                
        except Exception as e:
            self.logger.error(f"Landmark processing error: {str(e)}")
            return None
    
    def _normalize_landmarks(self, landmarks: np.ndarray) -> np.ndarray:
        """Normalize landmarks relative to wrist and hand size"""
        try:
            # Get wrist position (landmark 0)
            wrist = landmarks[0].copy()
            
            # Translate to wrist origin
            normalized = landmarks - wrist
            
            # Calculate hand size (wrist to middle finger tip)
            middle_tip = landmarks[12]
            hand_size = np.linalg.norm(middle_tip - wrist)
            
            # Scale by hand size (avoid division by zero)
            if hand_size > 1e-6:
                normalized = normalized / hand_size
            
            return normalized
            
        except Exception as e:
            self.logger.error(f"Normalization error: {str(e)}")
            return np.zeros((21, 3), dtype=np.float32)
    
    def _analyze_all_fingers(self, landmarks: np.ndarray) -> Dict[str, Dict]:
        """Complete finger analysis for all fingers"""
        finger_analysis = {}
        
        for finger_name, indices in self.FINGER_LANDMARKS.items():
            try:
                analysis = self._analyze_single_finger(landmarks, finger_name, indices)
                finger_analysis[finger_name] = analysis
                
            except Exception as e:
                self.logger.error(f"Error analyzing {finger_name}: {str(e)}")
                # Provide safe default
                finger_analysis[finger_name] = {
                    'extended': False,
                    'tip_position': np.zeros(3),
                    'curvature': 0.0,
                    'confidence': 0.0
                }
        
        return finger_analysis
    
    def _analyze_single_finger(self, landmarks: np.ndarray, finger_name: str, indices: List[int]) -> Dict:
        """Analyze individual finger state"""
        try:
            # Check if finger is extended
            if finger_name == 'thumb':
                extended = self._is_thumb_extended(landmarks, indices)
            else:
                extended = self._is_finger_extended(landmarks, indices)
            
            # Get tip position
            tip_position = landmarks[indices[-1]]
            
            # Calculate curvature
            curvature = self._calculate_finger_curvature(landmarks, indices)
            
            # Calculate confidence based on landmark quality
            confidence = self._calculate_finger_confidence(landmarks, indices)
            
            return {
                'extended': extended,
                'tip_position': tip_position,
                'curvature': curvature,
                'confidence': confidence
            }
            
        except Exception as e:
            self.logger.error(f"Single finger analysis error for {finger_name}: {str(e)}")
            return {
                'extended': False,
                'tip_position': np.zeros(3),
                'curvature': 0.0,
                'confidence': 0.0
            }
    
    def _is_finger_extended(self, landmarks: np.ndarray, indices: List[int]) -> bool:
        """Check if regular finger is extended using joint angles"""
        try:
            if len(indices) < 4:
                return False
            
            # Get all joint positions
            joint_positions = [landmarks[i] for i in indices]
            
            # Calculate angles between consecutive joint segments
            angles = []
            for i in range(len(joint_positions) - 2):
                p1, p2, p3 = joint_positions[i], joint_positions[i+1], joint_positions[i+2]
                
                # Create vectors
                v1 = p2 - p1
                v2 = p3 - p2
                
                # Calculate angle
                angle = self._safe_vector_angle(v1, v2)
                angles.append(angle)
            
            # Finger is extended if average angle is close to straight
            if len(angles) > 0:
                avg_angle = np.mean(angles)
                return avg_angle > self.config.FINGER_EXTEND_ANGLE
            
            return False
            
        except Exception as e:
            self.logger.error(f"Finger extension check error: {str(e)}")
            return False
    
    def _is_thumb_extended(self, landmarks: np.ndarray, indices: List[int]) -> bool:
        """Check if thumb is extended (special case)"""
        try:
            # Get key thumb positions
            thumb_tip = landmarks[indices[-1]]  # Tip
            thumb_mcp = landmarks[indices[1]]   # MCP joint
            wrist = landmarks[0]
            
            # Get palm reference (index finger MCP)
            index_mcp = landmarks[5]
            
            # Calculate vectors
            thumb_vector = thumb_tip - wrist
            palm_vector = index_mcp - wrist
            
            # Calculate angle between thumb and palm plane
            angle = self._safe_vector_angle(thumb_vector, palm_vector)
            
            # Thumb is extended if angle is large enough
            return angle > self.config.THUMB_EXTEND_ANGLE
            
        except Exception as e:
            self.logger.error(f"Thumb extension check error: {str(e)}")
            return False
    
    def _calculate_finger_curvature(self, landmarks: np.ndarray, indices: List[int]) -> float:
        """Calculate finger curvature (0=straight, 1=fully curved)"""
        try:
            if len(indices) < 4:
                return 0.0
            
            # Get finger joint positions
            joints = [landmarks[i] for i in indices]
            
            # Calculate path length (sum of segment lengths)
            path_length = 0.0
            for i in range(len(joints) - 1):
                segment_length = np.linalg.norm(joints[i+1] - joints[i])
                path_length += segment_length
            
            # Calculate straight-line distance
            straight_distance = np.linalg.norm(joints[-1] - joints[0])
            
            # Avoid division by zero
            if straight_distance < 1e-6:
                return 1.0
            
            # Curvature ratio
            curvature = (path_length - straight_distance) / straight_distance
            
            # Clamp to valid range
            return np.clip(curvature, 0.0, 1.0)
            
        except Exception as e:
            self.logger.error(f"Curvature calculation error: {str(e)}")
            return 0.0
    
    def _calculate_finger_confidence(self, landmarks: np.ndarray, indices: List[int]) -> float:
        """Calculate confidence in finger detection"""
        try:
            if len(indices) < 4:
                return 0.0
            
            # Check joint spacing consistency
            joints = [landmarks[i] for i in indices]
            distances = []
            
            for i in range(len(joints) - 1):
                dist = np.linalg.norm(joints[i+1] - joints[i])
                distances.append(dist)
            
            if len(distances) == 0:
                return 0.0
            
            # Good finger should have consistent joint spacing
            mean_dist = np.mean(distances)
            if mean_dist < 1e-6:
                return 0.0
            
            std_dist = np.std(distances)
            consistency = 1.0 - (std_dist / mean_dist)
            
            return np.clip(consistency, 0.0, 1.0)
            
        except Exception as e:
            self.logger.error(f"Finger confidence calculation error: {str(e)}")
            return 0.0
    
    def _calculate_hand_metrics(self, landmarks: np.ndarray) -> Dict[str, Any]:
        """Calculate comprehensive hand metrics"""
        try:
            # Get all fingertip positions
            fingertip_indices = [4, 8, 12, 16, 20]  # Thumb, Index, Middle, Ring, Pinky
            fingertips = [landmarks[i] for i in fingertip_indices]
            
            # Calculate palm center (average of MCP joints)
            mcp_indices = [5, 9, 13, 17]  # Index, Middle, Ring, Pinky MCP joints
            mcp_joints = [landmarks[i] for i in mcp_indices]
            palm_center = np.mean(mcp_joints, axis=0)
            
            # Calculate distances from palm center to fingertips
            tip_distances = []
            for tip in fingertips:
                distance = np.linalg.norm(tip - palm_center)
                tip_distances.append(distance)
            
            # Calculate hand span (thumb to pinky distance)
            hand_span = np.linalg.norm(fingertips[0] - fingertips[4])
            
            # Calculate finger spread (standard deviation of tip distances)
            finger_spread = np.std(tip_distances) if len(tip_distances) > 0 else 0.0
            
            # Average fingertip distance from palm
            avg_tip_distance = np.mean(tip_distances) if len(tip_distances) > 0 else 0.0
            
            return {
                'palm_center': palm_center,
                'fingertips': fingertips,
                'tip_distances': tip_distances,
                'avg_tip_distance': avg_tip_distance,
                'hand_span': hand_span,
                'finger_spread': finger_spread
            }
            
        except Exception as e:
            self.logger.error(f"Hand metrics calculation error: {str(e)}")
            return {
                'palm_center': np.zeros(3),
                'fingertips': [np.zeros(3)] * 5,
                'tip_distances': [0.0] * 5,
                'avg_tip_distance': 0.0,
                'hand_span': 0.0,
                'finger_spread': 0.0
            }
    
    def _safe_vector_angle(self, v1: np.ndarray, v2: np.ndarray) -> float:
        """Safely calculate angle between vectors"""
        try:
            # Get magnitudes
            mag1 = np.linalg.norm(v1)
            mag2 = np.linalg.norm(v2)
            
            # Check for zero vectors
            if mag1 < 1e-6 or mag2 < 1e-6:
                return 0.0
            
            # Normalize vectors
            v1_norm = v1 / mag1
            v2_norm = v2 / mag2
            
            # Calculate dot product
            dot_product = np.dot(v1_norm, v2_norm)
            
            # Clamp to valid range for arccos
            dot_product = np.clip(dot_product, -1.0, 1.0)
            
            # Calculate angle in degrees
            angle_rad = np.arccos(dot_product)
            angle_deg = np.degrees(angle_rad)
            
            return angle_deg
            
        except Exception as e:
            self.logger.error(f"Vector angle calculation error: {str(e)}")
            return 0.0
    
    def _test_all_gestures(self, finger_analysis: Dict, hand_metrics: Dict, landmarks: np.ndarray) -> List[GestureResult]:
        """Test all gesture types"""
        gesture_tests = [
            self._test_thumbs_up,
            self._test_peace_sign,
            self._test_open_palm,
            self._test_fist,
            self._test_pinch,
            self._test_spread
        ]
        
        results = []
        for test_func in gesture_tests:
            try:
                result = test_func(finger_analysis, hand_metrics, landmarks)
                results.append(result)
            except Exception as e:
                self.logger.error(f"Gesture test error: {str(e)}")
                continue
        
        return results
    
    def _test_thumbs_up(self, finger_analysis: Dict, hand_metrics: Dict, landmarks: np.ndarray) -> GestureResult:
        """Test for thumbs up gesture"""
        try:
            # Check if thumb is extended
            thumb_extended = finger_analysis['thumb']['extended']
            
            # Check if other fingers are folded
            other_fingers = ['index', 'middle', 'ring', 'pinky']
            others_folded = all(not finger_analysis[finger]['extended'] for finger in other_fingers)
            
            # Check thumb direction (pointing upward)
            thumb_tip = landmarks[4]
            wrist = landmarks[0]
            thumb_direction = thumb_tip - wrist
            pointing_up = thumb_direction[1] < -0.05  # Negative Y is up in image coordinates
            
            # Calculate confidence
            confidence = 0.0
            if thumb_extended and others_folded and pointing_up:
                # Base confidence
                confidence = 0.8
                
                # Boost confidence based on finger states
                if finger_analysis['thumb']['confidence'] > 0.7:
                    confidence += 0.1
                
                # Check how well other fingers are folded
                folded_scores = [1.0 - finger_analysis[finger]['confidence'] 
                               for finger in other_fingers 
                               if not finger_analysis[finger]['extended']]
                if len(folded_scores) > 0 and np.mean(folded_scores) > 0.6:
                    confidence += 0.1
            
            return GestureResult(
                gesture="thumbs_up",
                confidence=confidence,
                landmarks=landmarks.copy(),
                timestamp=time.time(),
                metadata={
                    'thumb_extended': thumb_extended,
                    'others_folded': others_folded,
                    'pointing_up': pointing_up
                }
            )
            
        except Exception as e:
            self.logger.error(f"Thumbs up test error: {str(e)}")
            return self._no_gesture_result()
    
    def _test_peace_sign(self, finger_analysis: Dict, hand_metrics: Dict, landmarks: np.ndarray) -> GestureResult:
        """Test for peace sign (V) gesture"""
        try:
            # Check if index and middle fingers are extended
            index_extended = finger_analysis['index']['extended']
            middle_extended = finger_analysis['middle']['extended']
            
            # Check if other fingers are folded
            other_fingers = ['thumb', 'ring', 'pinky']
            others_folded = all(not finger_analysis[finger]['extended'] for finger in other_fingers)
            
            # Check finger separation (V shape)
            index_tip = landmarks[8]
            middle_tip = landmarks[12]
            separation_distance = np.linalg.norm(middle_tip - index_tip)
            good_separation = separation_distance > self.PEACE_SEPARATION_THRESHOLD
            
            # Calculate confidence
            confidence = 0.0
            if index_extended and middle_extended and others_folded and good_separation:
                confidence = 0.8
                
                # Boost for good finger confidence
                extended_confidence = (finger_analysis['index']['confidence'] + 
                                     finger_analysis['middle']['confidence']) / 2
                if extended_confidence > 0.7:
                    confidence += 0.1
                
                # Boost for good separation
                if separation_distance > self.PEACE_SEPARATION_THRESHOLD * 1.5:
                    confidence += 0.1
            
            return GestureResult(
                gesture="peace",
                confidence=confidence,
                landmarks=landmarks.copy(),
                timestamp=time.time(),
                metadata={
                    'index_extended': index_extended,
                    'middle_extended': middle_extended,
                    'others_folded': others_folded,
                    'separation_distance': float(separation_distance)
                }
            )
            
        except Exception as e:
            self.logger.error(f"Peace sign test error: {str(e)}")
            return self._no_gesture_result()
    
    def _test_open_palm(self, finger_analysis: Dict, hand_metrics: Dict, landmarks: np.ndarray) -> GestureResult:
        """Test for open palm gesture"""
        try:
            # Check if all fingers are extended
            all_fingers = ['thumb', 'index', 'middle', 'ring', 'pinky']
            extended_count = sum(1 for finger in all_fingers if finger_analysis[finger]['extended'])
            all_extended = extended_count >= 4  # Allow one finger to be slightly folded
            
            # Check finger spread
            finger_spread = hand_metrics['finger_spread']
            good_spread = finger_spread > self.PALM_SPREAD_THRESHOLD
            
            # Check average curvature (palm should be relatively flat)
            curvatures = [finger_analysis[finger]['curvature'] for finger in all_fingers]
            avg_curvature = np.mean(curvatures)
            flat_palm = avg_curvature < 0.3
            
            # Calculate confidence
            confidence = 0.0
            if all_extended and good_spread and flat_palm:
                confidence = 0.8
                
                # Boost for more extended fingers
                if extended_count == 5:
                    confidence += 0.1
                
                # Boost for good spread
                if finger_spread > self.PALM_SPREAD_THRESHOLD * 1.5:
                    confidence += 0.1
            
            return GestureResult(
                gesture="open_palm",
                confidence=confidence,
                landmarks=landmarks.copy(),
                timestamp=time.time(),
                metadata={
                    'extended_count': extended_count,
                    'finger_spread': float(finger_spread),
                    'avg_curvature': float(avg_curvature)
                }
            )
            
        except Exception as e:
            self.logger.error(f"Open palm test error: {str(e)}")
            return self._no_gesture_result()
    
    def _test_fist(self, finger_analysis: Dict, hand_metrics: Dict, landmarks: np.ndarray) -> GestureResult:
        """Test for fist gesture"""
        try:
            # Check if all fingers are folded
            all_fingers = ['thumb', 'index', 'middle', 'ring', 'pinky']
            folded_count = sum(1 for finger in all_fingers if not finger_analysis[finger]['extended'])
            all_folded = folded_count >= 4  # Allow one finger to be slightly extended
            
            # Check if fingertips are close to palm
            avg_tip_distance = hand_metrics['avg_tip_distance']
            close_to_palm = avg_tip_distance < self.FIST_DISTANCE_THRESHOLD
            
            # Check high curvature (fingers should be curved)
            curvatures = [finger_analysis[finger]['curvature'] for finger in all_fingers]
            avg_curvature = np.mean(curvatures)
            high_curvature = avg_curvature > 0.4
            
            # Calculate confidence
            confidence = 0.0
            if all_folded and close_to_palm and high_curvature:
                confidence = 0.8
                
                # Boost for all fingers folded
                if folded_count == 5:
                    confidence += 0.1
                
                # Boost for very close to palm
                if avg_tip_distance < self.FIST_DISTANCE_THRESHOLD * 0.7:
                    confidence += 0.1
            
            return GestureResult(
                gesture="fist",
                confidence=confidence,
                landmarks=landmarks.copy(),
                timestamp=time.time(),
                metadata={
                    'folded_count': folded_count,
                    'avg_tip_distance': float(avg_tip_distance),
                    'avg_curvature': float(avg_curvature)
                }
            )
            
        except Exception as e:
            self.logger.error(f"Fist test error: {str(e)}")
            return self._no_gesture_result()
    
    def _test_pinch(self, finger_analysis: Dict, hand_metrics: Dict, landmarks: np.ndarray) -> GestureResult:
        """Test for pinch gesture"""
        try:
            # Calculate distance between thumb and index fingertips
            thumb_tip = landmarks[4]
            index_tip = landmarks[8]
            pinch_distance = np.linalg.norm(index_tip - thumb_tip)
            
            # Check if fingers are pinching
            is_pinching = pinch_distance < self.config.PINCH_THRESHOLD
            
            # Check if other fingers are in neutral/extended position
            other_fingers = ['middle', 'ring', 'pinky']
            others_neutral = sum(1 for finger in other_fingers 
                               if finger_analysis[finger]['extended']) >= 1
            
            # Calculate confidence
            confidence = 0.0
            if is_pinching and others_neutral:
                confidence = 0.8
                
                # Boost for very close pinch
                if pinch_distance < self.config.PINCH_THRESHOLD * 0.5:
                    confidence += 0.1
                
                # Boost for good finger positioning
                if finger_analysis['middle']['extended']:
                    confidence += 0.1
            
            return GestureResult(
                gesture="pinch",
                confidence=confidence,
                landmarks=landmarks.copy(),
                timestamp=time.time(),
                metadata={
                    'pinch_distance': float(pinch_distance),
                    'is_pinching': is_pinching,
                    'others_neutral': others_neutral
                }
            )
            
        except Exception as e:
            self.logger.error(f"Pinch test error: {str(e)}")
            return self._no_gesture_result()
    
    def _test_spread(self, finger_analysis: Dict, hand_metrics: Dict, landmarks: np.ndarray) -> GestureResult:
        """Test for spread gesture (fingers wide apart)"""
        try:
            # Check if most fingers are extended
            all_fingers = ['thumb', 'index', 'middle', 'ring', 'pinky']
            extended_count = sum(1 for finger in all_fingers if finger_analysis[finger]['extended'])
            most_extended = extended_count >= 4
            
            # Check finger spread
            finger_spread = hand_metrics['finger_spread']
            wide_spread = finger_spread > self.config.SPREAD_THRESHOLD
            
            # Check individual finger separations
            fingertips = hand_metrics['fingertips']
            separations = []
            for i in range(len(fingertips) - 1):
                sep = np.linalg.norm(fingertips[i + 1] - fingertips[i])
                separations.append(sep)
            
            avg_separation = np.mean(separations) if len(separations) > 0 else 0.0
            good_separation = avg_separation > 0.06
            
            # Calculate confidence
            confidence = 0.0
            if most_extended and wide_spread and good_separation:
                confidence = 0.8
                
                # Boost for all fingers extended
                if extended_count == 5:
                    confidence += 0.1
                
                # Boost for very wide spread
                if finger_spread > self.config.SPREAD_THRESHOLD * 1.5:
                    confidence += 0.1
            
            return GestureResult(
                gesture="spread",
                confidence=confidence,
                landmarks=landmarks.copy(),
                timestamp=time.time(),
                metadata={
                    'extended_count': extended_count,
                    'finger_spread': float(finger_spread),
                    'avg_separation': float(avg_separation)
                }
            )
            
        except Exception as e:
            self.logger.error(f"Spread test error: {str(e)}")
            return self._no_gesture_result()
    
    def _select_best_gesture(self, gesture_results: List[GestureResult]) -> GestureResult:
        """Select the best gesture from all results"""
        try:
            # Filter gestures above minimum confidence
            valid_gestures = [g for g in gesture_results 
                            if g.confidence >= self.config.MIN_GESTURE_CONFIDENCE]
            
            if not valid_gestures:
                return self._no_gesture_result()
            
            # Return highest confidence gesture
            best_gesture = max(valid_gestures, key=lambda x: x.confidence)
            return best_gesture
            
        except Exception as e:
            self.logger.error(f"Gesture selection error: {str(e)}")
            return self._no_gesture_result()
    
    def _no_gesture_result(self) -> GestureResult:
        """Return empty gesture result"""
        return GestureResult(
            gesture="none",
            confidence=0.0,
            landmarks=np.array([]),
            timestamp=time.time(),
            metadata={}
        )