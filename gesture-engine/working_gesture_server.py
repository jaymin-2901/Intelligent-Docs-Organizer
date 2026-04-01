#!/usr/bin/env python3
"""
WORKING Gesture Recognition WebSocket Server
- Guaranteed to start and accept connections
- Fallback modes if MediaPipe fails
- Proper WebSocket handling
"""
import asyncio
import websockets
import json
import logging
import threading
import queue
import time
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
# ── DEPENDENCY CHECKS ────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

OPENCV_AVAILABLE = False
MEDIAPIPE_AVAILABLE = False

try:
    import cv2
    OPENCV_AVAILABLE = True
    logger.info(f"✅ OpenCV {cv2.__version__}")
except ImportError:
    logger.warning("⚠️ OpenCV not available - simulation mode only")

try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_tasks
    from mediapipe.tasks.python import vision as mp_vision
    MEDIAPIPE_AVAILABLE = True
    logger.info(f"✅ MediaPipe {mp.__version__}")
except ImportError:
    logger.warning("⚠️ MediaPipe not available - simulation mode only")

# ══════════════════════════════════════════════════════════════════════════════
# ── GESTURE MAPPINGS ─────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════────════════════════

ACTION_MAP = {
    'thumbs_up':   'bookmark',
    'peace':       'summary', 
    'open_palm':   'showDocuments',
    'fist':        'close',
    'pointing':    'select',
    'rock_sign':   'rock',
    'ok_sign':     'confirm',
    'three':       'three',
    'four':        'four',
    'swipe_left':  'prevPage',
    'swipe_right': 'nextPage',
    'swipe_up':    'prevDocument',
    'swipe_down':  'nextDocument',
    'pinch_in':    'zoomOut',
    'pinch_out':   'zoomIn',
}

# ══════════════════════════════════════════════════════════════════════════════
# ── GESTURE DETECTORS ────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

class SimulationDetector:
    """Always works - cycles through gestures for testing"""
    
    def __init__(self):
        self.gestures = [
            ('thumbs_up',   0.95),
            ('peace',       0.92),
            ('open_palm',   0.88),
            ('fist',        0.85),
            ('swipe_left',  0.82),
            ('swipe_right', 0.82),
        ]
        self.index = 0
        logger.info("✅ Simulation detector ready")
    
    def get_next_gesture(self):
        gesture, confidence = self.gestures[self.index]
        self.index = (self.index + 1) % len(self.gestures)
        return {
            'gesture': gesture,
            'confidence': confidence,
            'detection_type': 'simulation'
        }

class MediaPipeDetector:
    """Real MediaPipe detection - with fallback if initialization fails"""
    
    def __init__(self):
        self.detector = None
        self.history = []
        self.frame_counter = 0
        
        try:
            # Try to initialize MediaPipe
            self._init_mediapipe()
            logger.info("✅ MediaPipe detector ready")
        except Exception as e:
            logger.error(f"❌ MediaPipe init failed: {e}")
            raise
    
    def _init_mediapipe(self):
        """Initialize MediaPipe with proper error handling"""
        try:
            # Method 1: Try without model file (use default)
            options = mp_vision.HandLandmarkerOptions(
                running_mode=mp_vision.RunningMode.VIDEO,
                num_hands=1,
                min_hand_detection_confidence=0.7,
                min_hand_presence_confidence=0.5,
                min_tracking_confidence=0.5
            )
            self.detector = mp_vision.HandLandmarker.create_from_options(options)
            logger.info("✅ Using default MediaPipe model")
            return
        except Exception as e1:
            logger.warning(f"Default model failed: {e1}")
        
        try:
            # Method 2: Try with explicit base options
            base_options = mp_tasks.BaseOptions()
            options = mp_vision.HandLandmarkerOptions(
                base_options=base_options,
                running_mode=mp_vision.RunningMode.VIDEO,
                num_hands=1,
                min_hand_detection_confidence=0.7,
                min_hand_presence_confidence=0.5,
                min_tracking_confidence=0.5
            )
            self.detector = mp_vision.HandLandmarker.create_from_options(options)
            logger.info("✅ Using MediaPipe with base options")
            return
        except Exception as e2:
            logger.error(f"Base options failed: {e2}")
            
        # Method 3: Download model (as last resort)
        try:
            model_path = self._download_model()
            base_options = mp_tasks.BaseOptions(model_asset_path=model_path)
            options = mp_vision.HandLandmarkerOptions(
                base_options=base_options,
                running_mode=mp_vision.RunningMode.VIDEO,
                num_hands=1,
                min_hand_detection_confidence=0.7,
                min_hand_presence_confidence=0.5,
                min_tracking_confidence=0.5
            )
            self.detector = mp_vision.HandLandmarker.create_from_options(options)
            logger.info("✅ Using downloaded MediaPipe model")
        except Exception as e3:
            logger.error(f"Downloaded model failed: {e3}")
            raise Exception("All MediaPipe initialization methods failed")
    
    def _download_model(self):
        """Download MediaPipe hand landmark model"""
        import urllib.request
        import os
        
        model_file = "hand_landmarker.task"
        model_url = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
        
        if os.path.exists(model_file):
            return model_file
            
        logger.info("📥 Downloading MediaPipe model...")
        urllib.request.urlretrieve(model_url, model_file)
        logger.info("✅ Model downloaded")
        return model_file
    
    def process_frame(self, frame):
        """Process video frame and detect gestures"""
        try:
            self.frame_counter += 1
            timestamp_ms = self.frame_counter * 33  # 30 FPS
            
            # Convert and create MediaPipe image
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
            
            # Detect hands
            result = self.detector.detect_for_video(mp_image, timestamp_ms)
            
            if not result.hand_landmarks:
                return None
                
            # Simple gesture recognition
            landmarks = result.hand_landmarks[0]
            gesture = self._classify_gesture(landmarks)
            
            if gesture:
                return {
                    'gesture': gesture['name'],
                    'confidence': gesture['confidence'],
                    'detection_type': 'mediapipe'
                }
                
        except Exception as e:
            logger.error(f"Frame processing error: {e}")
        
        return None
    
    def _classify_gesture(self, landmarks):
        """Simple gesture classification"""
        try:
            # Get finger tip and pip positions
            tips = [4, 8, 12, 16, 20]
            pips = [3, 6, 10, 14, 18]
            
            fingers_up = []
            
            # Thumb
            if landmarks[tips[0]].x > landmarks[pips[0]].x:
                fingers_up.append(1)
            else:
                fingers_up.append(0)
            
            # Other fingers
            for i in range(1, 5):
                if landmarks[tips[i]].y < landmarks[pips[i]].y:
                    fingers_up.append(1)
                else:
                    fingers_up.append(0)
            
            finger_count = sum(fingers_up)
            
            # Classify gestures
            if fingers_up == [1, 0, 0, 0, 0]:
                return {'name': 'thumbs_up', 'confidence': 0.9}
            elif fingers_up == [0, 1, 1, 0, 0]:
                return {'name': 'peace', 'confidence': 0.9}
            elif finger_count >= 4:
                return {'name': 'open_palm', 'confidence': 0.85}
            elif finger_count == 0:
                return {'name': 'fist', 'confidence': 0.85}
            elif fingers_up == [0, 1, 0, 0, 0]:
                return {'name': 'pointing', 'confidence': 0.8}
            
        except Exception as e:
            logger.warning(f"Gesture classification error: {e}")
        
        return None

# ══════════════════════════════════════════════════════════════════════════════
# ── WEBSOCKET SERVER ─────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

class GestureServer:
    def __init__(self, host='localhost', port=8765):
        self.host = host
        self.port = port
        self.clients = set()
        self.gesture_queue = queue.Queue()
        self.running = True
        self.last_gesture_time = 0
        self.gesture_cooldown = 1.5
        
        # Initialize detector
        self.detector = None
        self.detection_mode = 'simulation'
        self._init_detector()
    
    def _init_detector(self):
        """Initialize the best available detector"""
        if MEDIAPIPE_AVAILABLE and OPENCV_AVAILABLE:
            try:
                self.detector = MediaPipeDetector()
                self.detection_mode = 'mediapipe'
                logger.info("🎯 Using MediaPipe detection")
                return
            except Exception as e:
                logger.warning(f"MediaPipe failed: {e}")
        
        # Fallback to simulation
        self.detector = SimulationDetector()
        self.detection_mode = 'simulation'
        logger.info("🎮 Using simulation mode")
    
    async def handle_client(self, websocket, path=None):
        """Handle new WebSocket client"""
        self.clients.add(websocket)
        client_addr = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        logger.info(f"✅ Client connected: {client_addr} (total: {len(self.clients)})")
        
        # Send welcome message
        await self.send_to_client(websocket, {
            'type': 'status',
            'message': 'Connected to gesture server',
            'server_mode': self.detection_mode,
            'camera_active': self.detection_mode == 'mediapipe',
            'supported_gestures': list(ACTION_MAP.keys()),
            'timestamp': datetime.now().isoformat()
        })
        
        try:
            async for message in websocket:
                await self.handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.discard(websocket)
            logger.info(f"❌ Client disconnected: {client_addr} (remaining: {len(self.clients)})")
    
    async def handle_message(self, websocket, raw_message):
        """Handle incoming WebSocket message"""
        try:
            data = json.loads(raw_message)
            msg_type = data.get('type', '')
            
            if msg_type == 'ping':
                await self.send_to_client(websocket, {
                    'type': 'pong',
                    'timestamp': datetime.now().isoformat()
                })
            elif msg_type == 'command':
                command = data.get('command', '')
                if command == 'get_status':
                    await self.send_to_client(websocket, {
                        'type': 'status',
                        'message': 'Server running',
                        'active_clients': len(self.clients),
                        'server_mode': self.detection_mode,
                        'timestamp': datetime.now().isoformat()
                    })
        except json.JSONDecodeError:
            logger.warning("Received invalid JSON")
    
    async def send_to_client(self, websocket, message):
        """Send message to specific client"""
        try:
            await websocket.send(json.dumps(message))
        except Exception as e:
            logger.warning(f"Failed to send to client: {e}")
    
    async def broadcast(self, message):
        """Broadcast message to all clients"""
        if not self.clients:
            return
        
        dead_clients = set()
        json_message = json.dumps(message)
        
        for client in list(self.clients):
            try:
                await client.send(json_message)
            except Exception:
                dead_clients.add(client)
        
        # Remove dead clients
        self.clients -= dead_clients
    
    def detection_loop(self):
        """Background thread for gesture detection"""
        logger.info(f"🔄 Starting {self.detection_mode} detection loop")
        
        if self.detection_mode == 'mediapipe':
            self._camera_loop()
        else:
            self._simulation_loop()
    
    def _camera_loop(self):
        """Camera-based detection loop"""
        cap = None
        try:
            cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                logger.error("❌ Camera failed to open")
                return
            
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            logger.info("📷 Camera loop started")
            
            while self.running:
                ret, frame = cap.read()
                if not ret:
                    continue
                
                result = self.detector.process_frame(frame)
                if result:
                    now = time.time()
                    if now - self.last_gesture_time >= self.gesture_cooldown:
                        self.last_gesture_time = now
                        self._queue_gesture(result)
                        
        except Exception as e:
            logger.error(f"Camera loop error: {e}")
        finally:
            if cap:
                cap.release()
    
    def _simulation_loop(self):
        """Simulation detection loop"""
        while self.running:
            time.sleep(4)  # Generate gesture every 4 seconds
            if self.clients:  # Only generate if clients connected
                result = self.detector.get_next_gesture()
                self._queue_gesture(result)
    
    def _queue_gesture(self, result):
        """Queue detected gesture for broadcasting"""
        gesture = result['gesture']
        action = ACTION_MAP.get(gesture, gesture)
        
        message = {
            'type': 'gesture',
            'gesture': gesture,
            'action': action,
            'confidence': result['confidence'],
            'detection_type': result['detection_type'],
            'server_mode': self.detection_mode,
            'timestamp': datetime.now().isoformat()
        }
        
        self.gesture_queue.put(message)
        logger.info(f"🎯 {gesture} → {action} (conf: {result['confidence']:.2f})")
    
    async def broadcaster(self):
        """Async task to broadcast gestures"""
        logger.info("📡 Broadcaster started")
        
        while self.running:
            try:
                # Get gesture from queue (non-blocking)
                message = self.gesture_queue.get_nowait()
                await self.broadcast(message)
            except queue.Empty:
                await asyncio.sleep(0.01)
    
    async def start(self):
        """Start the WebSocket server"""
        # Start detection in background thread
        detection_thread = threading.Thread(target=self.detection_loop, daemon=True)
        detection_thread.start()
        
        logger.info("=" * 60)
        logger.info(f"🚀 GESTURE SERVER STARTING")
        logger.info(f"📍 WebSocket: ws://{self.host}:{self.port}")
        logger.info(f"🎯 Detection: {self.detection_mode}")
        logger.info(f"📷 OpenCV: {OPENCV_AVAILABLE}")
        logger.info(f"🤖 MediaPipe: {MEDIAPIPE_AVAILABLE}")
        logger.info("=" * 60)
        
        try:
            # Start WebSocket server
            start_server = websockets.serve(
                self.handle_client,
                self.host,
                self.port,
                ping_interval=20,
                ping_timeout=10
            )
            
            logger.info(f"🌐 WebSocket server listening on ws://{self.host}:{self.port}")
            
            # Run server and broadcaster concurrently
            await asyncio.gather(
                start_server,
                self.broadcaster()
            )
            
        except Exception as e:
            logger.error(f"❌ Server failed to start: {e}")
            raise

# ══════════════════════════════════════════════════════════════════════════════
# ── MAIN ENTRY POINT ─────────────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════════════

async def main():
    server = GestureServer()
    try:
        await server.start()
    except KeyboardInterrupt:
        logger.info("🛑 Server stopped by user")
        server.running = False

if __name__ == '__main__':
    print("🎯 GESTURE RECOGNITION SERVER")
    print("=" * 60)
    asyncio.run(main())