import cv2
import numpy as np
import time
import os
from collections import deque

class GestureDetector:
    def __init__(self):
        self.gesture_history = deque(maxlen=10)
        self.last_detection_time = 0
        self.cooldown = 1.0  # seconds between gesture detections
        
        # Hand cascade for detection
        self.hand_cascade = None
        try:
            # Try to load hand cascade if available
            import cv2.data
            cascade_path = cv2.data.haarcascades + 'haarcascade_hand.xml'
            if os.path.exists(cascade_path):
                self.hand_cascade = cv2.CascadeClassifier(cascade_path)
        except:
            pass
        
        # Skin color range for hand detection (HSV)
        self.skin_lower = np.array([0, 20, 70], dtype=np.uint8)
        self.skin_upper = np.array([20, 255, 255], dtype=np.uint8)
    
    def detect_skin(self, frame):
        """Detect skin-colored regions"""
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, self.skin_lower, self.skin_upper)
        
        # Apply morphological operations
        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.erode(mask, kernel, iterations=2)
        mask = cv2.dilate(mask, kernel, iterations=2)
        
        return mask
    
    def find_contours(self, mask):
        """Find contours in the mask"""
        contours, _ = cv2.findContours(mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
        return contours
    
    def detect_hand_gesture(self, frame):
        """Detect hand and recognize gesture"""
        # Get skin mask
        mask = self.detect_skin(frame)
        contours = self.find_contours(mask)
        
        if not contours:
            return None, frame
        
        # Find largest contour (likely the hand)
        max_contour = max(contours, key=cv2.contourArea)
        
        if cv2.contourArea(max_contour) < 5000:  # Too small
            return None, frame
        
        # Get bounding rectangle
        x, y, w, h = cv2.boundingRect(max_contour)
        
        # Draw bounding box
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
        
        # Calculate convex hull
        hull = cv2.convexHull(max_contour, returnPoints=False)
        
        # Get defects
        try:
            defects = cv2.convexityDefects(max_contour, hull)
        except:
            defects = None
        
        gesture = None
        finger_count = 0
        
        if defects is not None:
            for i in range(defects.shape[0]):
                s, e, f, d = defects[i, 0]
                start = tuple(max_contour[s][0])
                end = tuple(max_contour[e][0])
                far = tuple(max_contour[f][0])
                
                # Calculate triangle angles
                a = np.sqrt((end[0] - start[0])**2 + (end[1] - start[1])**2)
                b = np.sqrt((far[0] - start[0])**2 + (far[1] - start[1])**2)
                c = np.sqrt((end[0] - far[0])**2 + (end[1] - far[1])**2)
                angle = np.arccos((b**2 + c**2 - a**2) / (2 * b * c))
                
                # Count fingers based on angle
                if angle <= np.pi / 2:
                    finger_count += 1
                    cv2.circle(frame, far, 5, [0, 0, 255], -1)
        
        # Determine gesture based on finger count
        if finger_count == 0:
            gesture = 'FIST'
        elif finger_count == 1:
            gesture = 'THUMBS_UP'
        elif finger_count == 2:
            gesture = 'PEACE_SIGN'
        elif finger_count >= 3 and finger_count <= 4:
            gesture = 'OPEN_PALM'
        elif finger_count >= 5:
            gesture = 'OPEN_PALM'
        
        # Draw info on frame
        cv2.putText(frame, f"Fingers: {finger_count}", (10, 70),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
        
        if gesture:
            cv2.putText(frame, f"Gesture: {gesture}", (10, 100),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        
        return gesture, frame
    
    def detect_swipe(self, current_x, frame_width):
        """Detect swipe gesture based on hand position"""
        center = frame_width / 2
        
        if current_x < center - 100:
            return 'SWIPE_RIGHT'
        elif current_x > center + 100:
            return 'SWIPE_LEFT'
        return None
    
    def detect(self, frame):
        """Main detection function"""
        current_time = time.time()
        
        # Detect hand gesture
        gesture, processed_frame = self.detect_hand_gesture(frame)
        
        # Apply cooldown
        if gesture and (current_time - self.last_detection_time) > self.cooldown:
            self.last_detection_time = current_time
            self.gesture_history.append(gesture)
            
            return {
                'gestures': [{'type': gesture, 'confidence': 0.8}],
                'timestamp': current_time
            }, processed_frame
        
        return {'gestures': []}, processed_frame


# Global instance
gesture_detector = GestureDetector()