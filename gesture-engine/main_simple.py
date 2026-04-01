"""
Main detector without MediaPipe
"""

import cv2
import numpy as np
import time
import threading
import logging
from typing import Optional, Callable
from gesture_simple import SimpleGestureDetector, SimpleDetectionResult

class SimpleGestureEngine:
    """Simple gesture engine without MediaPipe"""
    
    def __init__(self, detection_callback: Optional[Callable] = None, debug_mode: bool = True):
        self.detection_callback = detection_callback
        self.debug_mode = debug_mode
        
        # Components
        self.gesture_detector = SimpleGestureDetector()
        
        # Camera
        self.camera = None
        self.is_running = False
        self.detection_thread = None
        
        # Metrics
        self.fps = 0
        self.frame_count = 0
        self.start_time = time.time()
        
        self.logger = logging.getLogger(__name__)
        self.logger.info("Simple Gesture Engine initialized")
    
    def start(self) -> bool:
        """Start the engine"""
        try:
            self.camera = cv2.VideoCapture(0)
            if not self.camera.isOpened():
                self.logger.error("Failed to open camera")
                return False
            
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            
            self.is_running = True
            self.detection_thread = threading.Thread(target=self._detection_loop, daemon=True)
            self.detection_thread.start()
            
            self.logger.info("Simple gesture engine started")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to start: {e}")
            return False
    
    def stop(self):
        """Stop the engine"""
        self.is_running = False
        if self.detection_thread:
            self.detection_thread.join(timeout=2.0)
        if self.camera:
            self.camera.release()
        cv2.destroyAllWindows()
        
    def _detection_loop(self):
        """Main detection loop"""
        try:
            while self.is_running:
                ret, frame = self.camera.read()
                if not ret:
                    continue
                
                # Detect gestures
                result = self.gesture_detector.detect_gesture(frame)
                
                if result and self.detection_callback:
                    self.detection_callback(result)
                
                # Debug display
                if self.debug_mode:
                    debug_frame = self.gesture_detector.draw_debug(frame, result)
                    cv2.putText(debug_frame, f"FPS: {self.fps:.1f}", (500, 30),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
                    cv2.imshow("Simple Gesture Detection", debug_frame)
                    
                    key = cv2.waitKey(1) & 0xFF
                    if key == ord('q'):
                        break
                
                self._update_fps()
                time.sleep(0.01)
                
        except Exception as e:
            self.logger.error(f"Detection loop error: {e}")
    
    def _update_fps(self):
        """Update FPS"""
        self.frame_count += 1
        elapsed = time.time() - self.start_time
        if elapsed >= 1.0:
            self.fps = self.frame_count / elapsed
            self.frame_count = 0
            self.start_time = time.time()
    
    def get_status(self):
        """Get status"""
        return {
            'is_running': self.is_running,
            'fps': self.fps,
            'camera_connected': self.camera is not None and self.camera.isOpened()
        }