"""
MAIN GESTURE DETECTION ENGINE - FIXED VERSION
Coordinates all detection components and provides unified interface
"""

import cv2
import numpy as np
import time
import logging
from typing import Optional, Dict, Any, Callable
import threading
from dataclasses import dataclass

# Fix MediaPipe import
try:
    import mediapipe as mp
    # Check if solutions exists
    if hasattr(mp, 'solutions'):
        mp_hands = mp.solutions.hands
        mp_drawing = mp.solutions.drawing_utils
        mp_drawing_styles = mp.solutions.drawing_styles
    else:
        # Fallback for older versions
        from mediapipe.python.solutions import hands as mp_hands
        from mediapipe.python.solutions import drawing_utils as mp_drawing
        from mediapipe.python.solutions import drawing_styles as mp_drawing_styles
except ImportError as e:
    print(f"❌ MediaPipe import error: {e}")
    raise

# Import our custom components
from gesture_classifier import GestureClassifier, GestureResult
from swipe_detector import SwipeDetector, SwipeResult, SwipeDirection
from stability_filter import StabilityFilter, FilteredGestureResult

@dataclass
class DetectionResult:
    """Unified detection result"""
    gesture: Optional[str]
    swipe: Optional[SwipeDirection]
    confidence: float
    landmarks: np.ndarray
    timestamp: float
    debug_info: Dict[str, Any]

class GestureDetectionEngine:
    """
    MAIN GESTURE DETECTION ENGINE - FIXED VERSION
    Coordinates camera, MediaPipe, gesture classification, and swipe detection
    """
    
    def __init__(self, 
                 camera_id: int = 0,
                 detection_callback: Optional[Callable] = None,
                 debug_mode: bool = True):
        
        self.camera_id = camera_id
        self.detection_callback = detection_callback
        self.debug_mode = debug_mode
        
        # Initialize components
        self.gesture_classifier = GestureClassifier()
        self.swipe_detector = SwipeDetector()
        self.stability_filter = StabilityFilter()
        
        # Initialize MediaPipe - FIXED VERSION
        try:
            if hasattr(mp, 'solutions'):
                # New MediaPipe API
                self.mp_hands_module = mp.solutions.hands
                self.mp_drawing = mp.solutions.drawing_utils
            else:
                # Old MediaPipe API
                self.mp_hands_module = mp_hands
                self.mp_drawing = mp_drawing
                
            # Initialize hands detector
            self.hands = self.mp_hands_module.Hands(
                static_image_mode=False,
                max_num_hands=1,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            
        except Exception as e:
            self.logger = logging.getLogger(__name__)
            self.logger.error(f"MediaPipe initialization error: {e}")
            raise
        
        # Camera and state
        self.camera = None
        self.is_running = False
        self.detection_thread = None
        
        # Performance metrics
        self.fps = 0
        self.frame_count = 0
        self.start_time = time.time()
        
        # Debug visualization
        self.show_debug = debug_mode
        self.debug_image = None
        
        # Setup logging with proper encoding
        self.logger = self._setup_logger()
        self.logger.info("Gesture Detection Engine initialized successfully")
    
    def _setup_logger(self):
        """Setup logger with proper encoding for Windows"""
        logger = logging.getLogger(__name__)
        
        # Clear existing handlers
        for handler in logger.handlers[:]:
            logger.removeHandler(handler)
        
        # Create new handler with UTF-8 encoding
        handler = logging.StreamHandler()
        handler.setLevel(logging.INFO)
        
        # Set formatter without unicode characters that cause issues
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        
        return logger
    
    def start(self) -> bool:
        """Start the gesture detection engine"""
        try:
            self.logger.info("Starting gesture detection engine...")
            
            # Initialize camera
            self.camera = cv2.VideoCapture(self.camera_id)
            if not self.camera.isOpened():
                self.logger.error(f"Failed to open camera {self.camera_id}")
                return False
            
            # Set camera properties
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            self.camera.set(cv2.CAP_PROP_FPS, 30)
            
            # Test camera
            ret, frame = self.camera.read()
            if not ret:
                self.logger.error("Failed to read from camera")
                return False
                
            self.logger.info(f"Camera initialized: {frame.shape}")
            
            # Start detection thread
            self.is_running = True
            self.detection_thread = threading.Thread(target=self._detection_loop, daemon=True)
            self.detection_thread.start()
            
            self.logger.info("Gesture detection started successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to start detection: {str(e)}")
            return False
    
    def stop(self):
        """Stop the gesture detection engine"""
        try:
            self.is_running = False
            
            if self.detection_thread:
                self.detection_thread.join(timeout=2.0)
            
            if self.camera:
                self.camera.release()
            
            cv2.destroyAllWindows()
            
            self.logger.info("Gesture detection stopped")
            
        except Exception as e:
            self.logger.error(f"Error stopping detection: {str(e)}")
    
    def _detection_loop(self):
        """Main detection loop running in separate thread"""
        try:
            self.logger.info("Detection loop started")
            
            while self.is_running:
                # Capture frame
                ret, frame = self.camera.read()
                if not ret:
                    self.logger.warning("Failed to capture frame")
                    time.sleep(0.1)
                    continue
                
                # Process frame
                detection_result = self._process_frame(frame)
                
                # Handle detection result
                if detection_result:
                    self._handle_detection(detection_result)
                
                # Update debug visualization
                if self.debug_mode:
                    self._update_debug_display(frame, detection_result)
                
                # Calculate FPS
                self._update_fps()
                
                # Small delay to prevent CPU overload
                time.sleep(0.01)
                
        except Exception as e:
            self.logger.error(f"Detection loop error: {str(e)}")
        finally:
            self.logger.info("Detection loop ended")
    
    def _process_frame(self, frame: np.ndarray) -> Optional[DetectionResult]:
        """Process single frame for gesture detection"""
        try:
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            rgb_frame.flags.writeable = False
            
            # Detect hands
            results = self.hands.process(rgb_frame)
            
            # Make frame writable again
            rgb_frame.flags.writeable = True
            
            if not results.multi_hand_landmarks:
                return None
            
            # Get first hand landmarks
            hand_landmarks = results.multi_hand_landmarks[0]
            
            # Convert to numpy array
            landmarks_array = self._landmarks_to_array(hand_landmarks)
            
            if landmarks_array is None:
                return None
            
            # Detect gesture
            gesture_result = self.gesture_classifier.detect_gesture(landmarks_array)
            filtered_gesture = self.stability_filter.filter_gesture(gesture_result)
            
            # Detect swipe
            swipe_result = self.swipe_detector.update(landmarks_array)
            filtered_swipe = self.stability_filter.filter_swipe(swipe_result) if swipe_result else None
            
            # Create unified result
            detection_result = DetectionResult(
                gesture=filtered_gesture.gesture if filtered_gesture else None,
                swipe=filtered_swipe.direction if filtered_swipe else None,
                confidence=filtered_gesture.confidence if filtered_gesture else 0.0,
                landmarks=landmarks_array,
                timestamp=time.time(),
                debug_info={
                    'raw_gesture': gesture_result.gesture,
                    'raw_confidence': gesture_result.confidence,
                    'swipe_confidence': filtered_swipe.confidence if filtered_swipe else 0.0,
                    'fps': self.fps,
                    'landmarks_detected': True
                }
            )
            
            return detection_result
            
        except Exception as e:
            self.logger.error(f"Frame processing error: {str(e)}")
            return None
    
    def _landmarks_to_array(self, landmarks) -> Optional[np.ndarray]:
        """Convert MediaPipe landmarks to numpy array"""
        try:
            if landmarks is None:
                return None
            
            # Extract landmark coordinates
            coords = []
            for landmark in landmarks.landmark:
                coords.append([landmark.x, landmark.y, landmark.z])
            
            return np.array(coords, dtype=np.float32)
            
        except Exception as e:
            self.logger.error(f"Landmarks conversion error: {str(e)}")
            return None
    
    def _handle_detection(self, detection_result: DetectionResult):
        """Handle detection result - call callback and log"""
        try:
            # Call external callback if provided
            if self.detection_callback:
                self.detection_callback(detection_result)
            
            # Log significant detections (without unicode)
            if detection_result.gesture and detection_result.gesture != "none":
                self.logger.info(f"Gesture detected: {detection_result.gesture} "
                               f"(confidence: {detection_result.confidence:.3f})")
            
            if detection_result.swipe and detection_result.swipe != SwipeDirection.NONE:
                self.logger.info(f"Swipe detected: {detection_result.swipe.value}")
                
        except Exception as e:
            self.logger.error(f"Detection handling error: {str(e)}")
    
    def _update_debug_display(self, frame: np.ndarray, detection_result: Optional[DetectionResult]):
        """Update debug visualization window"""
        try:
            if not self.show_debug:
                return
            
            debug_frame = frame.copy()
            
            # Draw landmarks if available
            if detection_result and len(detection_result.landmarks) > 0:
                self._draw_landmarks(debug_frame, detection_result.landmarks)
            
            # Draw detection info
            self._draw_detection_info(debug_frame, detection_result)
            
            # Draw FPS
            cv2.putText(debug_frame, f"FPS: {self.fps:.1f}", (10, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            # Show frame
            cv2.imshow("Gesture Detection Debug", debug_frame)
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                self.is_running = False
            
            self.debug_image = debug_frame
            
        except Exception as e:
            self.logger.error(f"Debug display error: {str(e)}")
    
    def _draw_landmarks(self, frame: np.ndarray, landmarks: np.ndarray):
        """Draw hand landmarks on frame"""
        try:
            h, w, _ = frame.shape
            
            # Draw landmark points
            for i, landmark in enumerate(landmarks):
                x = int(landmark[0] * w)
                y = int(landmark[1] * h)
                
                # Clamp coordinates to frame bounds
                x = max(0, min(x, w - 1))
                y = max(0, min(y, h - 1))
                
                # Draw point
                cv2.circle(frame, (x, y), 4, (0, 255, 0), -1)
                
                # Draw landmark number for key points
                if i in [0, 4, 8, 12, 16, 20]:  # Wrist and fingertips
                    cv2.putText(frame, str(i), (x + 5, y - 5),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.3, (255, 255, 255), 1)
            
            # Draw connections
            self._draw_hand_connections(frame, landmarks)
            
        except Exception as e:
            self.logger.error(f"Landmark drawing error: {str(e)}")
    
    def _draw_hand_connections(self, frame: np.ndarray, landmarks: np.ndarray):
        """Draw hand skeleton connections"""
        try:
            h, w, _ = frame.shape
            
            # Define hand connections
            connections = [
                # Thumb
                (0, 1), (1, 2), (2, 3), (3, 4),
                # Index finger
                (0, 5), (5, 6), (6, 7), (7, 8),
                # Middle finger
                (0, 9), (9, 10), (10, 11), (11, 12),
                # Ring finger
                (0, 13), (13, 14), (14, 15), (15, 16),
                # Pinky
                (0, 17), (17, 18), (18, 19), (19, 20),
                # Palm
                (5, 9), (9, 13), (13, 17)
            ]
            
            for start_idx, end_idx in connections:
                if start_idx < len(landmarks) and end_idx < len(landmarks):
                    start_point = landmarks[start_idx]
                    end_point = landmarks[end_idx]
                    
                    start_x = int(start_point[0] * w)
                    start_y = int(start_point[1] * h)
                    end_x = int(end_point[0] * w)
                    end_y = int(end_point[1] * h)
                    
                    # Clamp coordinates
                    start_x = max(0, min(start_x, w - 1))
                    start_y = max(0, min(start_y, h - 1))
                    end_x = max(0, min(end_x, w - 1))
                    end_y = max(0, min(end_y, h - 1))
                    
                    cv2.line(frame, (start_x, start_y), (end_x, end_y), (255, 0, 0), 2)
                    
        except Exception as e:
            self.logger.error(f"Connection drawing error: {str(e)}")
    
    def _draw_detection_info(self, frame: np.ndarray, detection_result: Optional[DetectionResult]):
        """Draw detection information on frame"""
        try:
            y_offset = 60
            line_height = 30
            
            if detection_result:
                # Draw gesture
                if detection_result.gesture:
                    gesture_text = f"Gesture: {detection_result.gesture} ({detection_result.confidence:.2f})"
                    cv2.putText(frame, gesture_text, (10, y_offset),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                    y_offset += line_height
                
                # Draw swipe
                if detection_result.swipe and detection_result.swipe != SwipeDirection.NONE:
                    swipe_text = f"Swipe: {detection_result.swipe.value}"
                    cv2.putText(frame, swipe_text, (10, y_offset),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 255), 2)
                    y_offset += line_height
            
            # Draw instructions
            instructions = [
                "Gestures: thumbs_up, peace, open_palm, fist, pinch, spread",
                "Swipes: up, down, left, right",
                "Press 'q' to quit"
            ]
            
            for i, instruction in enumerate(instructions):
                cv2.putText(frame, instruction, (10, frame.shape[0] - 60 + i * 20),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1)
                           
        except Exception as e:
            self.logger.error(f"Info drawing error: {str(e)}")
    
    def _update_fps(self):
        """Update FPS calculation"""
        try:
            self.frame_count += 1
            elapsed = time.time() - self.start_time
            
            if elapsed >= 1.0:  # Update every second
                self.fps = self.frame_count / elapsed
                self.frame_count = 0
                self.start_time = time.time()
                
        except Exception as e:
            self.logger.error(f"FPS update error: {str(e)}")
    
    def get_status(self) -> Dict[str, Any]:
        """Get engine status information"""
        try:
            return {
                'is_running': self.is_running,
                'fps': self.fps,
                'camera_connected': self.camera is not None and self.camera.isOpened(),
                'debug_mode': self.debug_mode,
                'gesture_filter_info': self.stability_filter.get_debug_info(),
                'swipe_debug_info': self.swipe_detector.get_debug_info()
            }
            
        except Exception as e:
            self.logger.error(f"Status check error: {str(e)}")
            return {'error': str(e)}
    
    def reset_filters(self):
        """Reset all filters and state"""
        try:
            self.stability_filter.reset()
            self.swipe_detector.reset()
            self.logger.info("All filters reset")
            
        except Exception as e:
            self.logger.error(f"Filter reset error: {str(e)}")