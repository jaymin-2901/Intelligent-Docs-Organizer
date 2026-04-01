"""
GESTURE DETECTION CONFIGURATION
Production-ready settings for optimal performance
"""

class GestureConfig:
    # Camera settings
    CAMERA_WIDTH = 640
    CAMERA_HEIGHT = 480
    CAMERA_FPS = 30
    
    # MediaPipe settings
    MEDIAPIPE_CONFIDENCE = 0.5
    MEDIAPIPE_TRACKING_CONFIDENCE = 0.5
    MAX_NUM_HANDS = 1
    
    # Gesture detection thresholds
    MIN_GESTURE_CONFIDENCE = 0.7
    HIGH_CONFIDENCE_THRESHOLD = 0.85
    
    # Finger detection thresholds
    FINGER_FOLD_THRESHOLD = 0.1
    FINGER_EXTEND_ANGLE = 140  # degrees
    THUMB_EXTEND_ANGLE = 60    # degrees
    
    # Distance thresholds (normalized to hand size)
    PINCH_THRESHOLD = 0.08
    SPREAD_THRESHOLD = 0.15
    PALM_THRESHOLD = 0.25
    
    # Swipe detection settings
    MIN_SWIPE_DISTANCE = 0.15
    MIN_SWIPE_SPEED = 0.8
    MAX_SWIPE_DURATION = 1.0
    SWIPE_DIRECTION_THRESHOLD = 0.7
    SWIPE_HISTORY_SIZE = 10
    SWIPE_COOLDOWN = 0.5  # seconds between swipes
    
    # Stability settings
    POSITION_SMOOTHING_FACTOR = 0.7
    GESTURE_DEBOUNCE_TIME = 1.0  # seconds
    CONFIDENCE_SMOOTHING_FRAMES = 5
    
    # WebSocket settings
    WEBSOCKET_HOST = "localhost"
    WEBSOCKET_PORT = 8765
    
    # Debug settings
    DEBUG_MODE = True
    SHOW_LANDMARKS = True
    SHOW_GESTURE_TEXT = True
    SAVE_DEBUG_VIDEO = False
    
    # Gesture mappings
    GESTURE_ACTIONS = {
        'thumbs_up': 'bookmark',
        'peace': 'ai_summary',
        'open_palm': 'show_documents',
        'fist': 'close',
        'pinch': 'zoom_out',
        'spread': 'zoom_in',
        'swipe_up': 'prev_document',
        'swipe_down': 'next_document',
        'swipe_left': 'prev_page',
        'swipe_right': 'next_page'
    }