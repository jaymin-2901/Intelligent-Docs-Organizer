#!/usr/bin/env python3
import asyncio
import websockets
import json
import cv2
import logging
from datetime import datetime
import threading
import queue
import time
import numpy as np

# MediaPipe imports - updated for newer versions
try:
    import mediapipe as mp
    # Try new import structure first (MediaPipe 0.10+)
    try:
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision
        from mediapipe import solutions
        from mediapipe.framework.formats import landmark_pb2
        NEW_MEDIAPIPE = True
        print("Using new MediaPipe API (0.10+)")
    except ImportError:
        # Fall back to old structure (MediaPipe 0.9.x)
        from mediapipe.python.solutions import hands as mp_hands
        from mediapipe.python.solutions import drawing_utils as mp_draw
        NEW_MEDIAPIPE = False
        print("Using legacy MediaPipe API (0.9.x)")
except ImportError as e:
    print(f"MediaPipe import error: {e}")
    print("Please install MediaPipe: pip install mediapipe")
    exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GestureWebSocketServer:
    def __init__(self, host='localhost', port=8765):
        self.host = host
        self.port = port
        self.clients = set()
        self.gesture_queue = queue.Queue()
        
        # Initialize MediaPipe based on version
        self.init_mediapipe()
        
        # Gesture detection state
        self.last_gesture = None
        self.gesture_start_time = None
        self.gesture_hold_time = 0.3  # seconds to hold gesture
        self.gesture_cooldown = 0.8   # seconds between gestures
        self.last_gesture_time = 0
        
        logger.info(f"Gesture WebSocket Server initialized on {host}:{port}")

    def init_mediapipe(self):
        """Initialize MediaPipe based on available version"""
        try:
            if NEW_MEDIAPIPE:
                # New MediaPipe API (0.10+)
                self.mp_hands = solutions.hands
                self.hands = self.mp_hands.Hands(
                    static_image_mode=False,
                    max_num_hands=1,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5
                )
                self.mp_draw = solutions.drawing_utils
                logger.info("MediaPipe initialized with new API")
            else:
                # Legacy MediaPipe API (0.9.x)
                self.hands = mp_hands.Hands(
                    static_image_mode=False,
                    max_num_hands=1,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5
                )
                self.mp_draw = mp_draw
                logger.info("MediaPipe initialized with legacy API")
                
        except Exception as e:
            logger.error(f"Failed to initialize MediaPipe: {e}")
            # Fallback manual initialization
            try:
                import mediapipe.python.solutions.hands as hands_module
                import mediapipe.python.solutions.drawing_utils as draw_module
                
                self.hands = hands_module.Hands(
                    static_image_mode=False,
                    max_num_hands=1,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5
                )
                self.mp_draw = draw_module
                logger.info("MediaPipe initialized with manual fallback")
            except Exception as fallback_error:
                logger.error(f"All MediaPipe initialization methods failed: {fallback_error}")
                raise

    async def register(self, websocket, path):
        self.clients.add(websocket)
        logger.info(f"Client connected: {websocket.remote_address}")
        
        # Send welcome message
        await self.send_to_client(websocket, {
            'type': 'status',
            'message': 'Connected to gesture detection server',
            'timestamp': datetime.now().isoformat(),
            'server_info': {
                'mediapipe_version': mp.__version__ if hasattr(mp, '__version__') else 'unknown',
                'api_type': 'new' if NEW_MEDIAPIPE else 'legacy'
            }
        })

    async def unregister(self, websocket):
        self.clients.discard(websocket)
        logger.info(f"Client disconnected: {websocket.remote_address}")

    async def send_to_client(self, websocket, data):
        try:
            await websocket.send(json.dumps(data))
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            logger.error(f"Error sending to client: {e}")

    async def broadcast(self, data):
        if self.clients:
            await asyncio.gather(
                *[self.send_to_client(client, data) for client in self.clients.copy()],
                return_exceptions=True
            )

    def detect_gesture(self, landmarks):
        """Detect gesture from hand landmarks"""
        if not landmarks or len(landmarks) < 21:
            return None
            
        # Extract landmark positions (MediaPipe landmarks are normalized 0-1)
        def get_landmark_coords(idx):
            return landmarks[idx].x, landmarks[idx].y, landmarks[idx].z if hasattr(landmarks[idx], 'z') else 0
        
        # Key landmarks
        thumb_tip = landmarks[4]      # Thumb tip
        thumb_ip = landmarks[3]       # Thumb interphalangeal
        thumb_mcp = landmarks[2]      # Thumb metacarpophalangeal
        
        index_tip = landmarks[8]      # Index finger tip
        index_pip = landmarks[6]      # Index finger PIP
        index_mcp = landmarks[5]      # Index finger MCP
        
        middle_tip = landmarks[12]    # Middle finger tip
        middle_pip = landmarks[10]    # Middle finger PIP
        
        ring_tip = landmarks[16]      # Ring finger tip
        ring_pip = landmarks[14]      # Ring finger PIP
        
        pinky_tip = landmarks[20]     # Pinky tip
        pinky_pip = landmarks[18]     # Pinky PIP
        
        # Helper functions
        def is_finger_extended(tip, pip, threshold=0.02):
            return tip.y < pip.y - threshold
        
        def is_finger_curled(tip, pip, threshold=0.02):
            return tip.y > pip.y + threshold
            
        def finger_distance(p1, p2):
            return np.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2)
        
        def is_thumb_up():
            return (thumb_tip.y < thumb_ip.y - 0.03 and 
                    thumb_tip.y < thumb_mcp.y and
                    thumb_tip.x > thumb_mcp.x)  # Thumb pointing up and right
        
        # Check finger states
        thumb_up = is_thumb_up()
        index_up = is_finger_extended(index_tip, index_pip)
        middle_up = is_finger_extended(middle_tip, middle_pip)
        ring_up = is_finger_extended(ring_tip, ring_pip)
        pinky_up = is_finger_extended(pinky_tip, pinky_pip)
        
        index_down = is_finger_curled(index_tip, index_pip)
        middle_down = is_finger_curled(middle_tip, middle_pip)
        ring_down = is_finger_curled(ring_tip, ring_pip)
        pinky_down = is_finger_curled(pinky_tip, pinky_pip)
        
        # Count extended fingers
        fingers_up = sum([thumb_up, index_up, middle_up, ring_up, pinky_up])
        
        # Gesture detection logic
        
        # 1. THUMBS UP - thumb up, all other fingers down
        if thumb_up and index_down and middle_down and ring_down and pinky_down:
            return {'gesture': 'thumbs_up', 'confidence': 0.92}
        
        # 2. PEACE SIGN - index and middle up, others down
        if index_up and middle_up and ring_down and pinky_down and not thumb_up:
            return {'gesture': 'peace', 'confidence': 0.88}
        
        # 3. OPEN PALM - most or all fingers up
        if fingers_up >= 4:
            return {'gesture': 'open_palm', 'confidence': 0.85}
        
        # 4. FIST - all fingers down
        if fingers_up <= 1 and index_down and middle_down and ring_down and pinky_down:
            return {'gesture': 'fist', 'confidence': 0.82}
        
        # 5. PINCH - thumb and index finger close together
        thumb_index_distance = finger_distance(thumb_tip, index_tip)
        if thumb_index_distance < 0.06:
            # Check if other fingers are extended (pinch out) or curled (pinch in)
            if middle_up or ring_up or pinky_up:
                return {'gesture': 'pinch_out', 'confidence': 0.78}
            else:
                return {'gesture': 'pinch_in', 'confidence': 0.78}
        
        # 6. POINTING - only index finger up
        if index_up and middle_down and ring_down and pinky_down and not thumb_up:
            return {'gesture': 'pointing', 'confidence': 0.80}
        
        # 7. OK SIGN - thumb and index forming circle, others extended
        if (thumb_index_distance < 0.05 and middle_up and ring_up and pinky_up):
            return {'gesture': 'ok_sign', 'confidence': 0.75}
        
        return None

    def detect_swipe_gesture(self, landmarks_history):
        """Detect swipe gestures based on hand movement history"""
        if len(landmarks_history) < 10:
            return None
        
        # Get palm center from last few frames
        palm_positions = []
        for landmarks in landmarks_history[-10:]:
            if landmarks:
                # Calculate palm center
                palm_x = (landmarks[0].x + landmarks[5].x + landmarks[17].x) / 3
                palm_y = (landmarks[0].y + landmarks[5].y + landmarks[17].y) / 3
                palm_positions.append((palm_x, palm_y))
        
        if len(palm_positions) < 5:
            return None
        
        # Calculate movement
        start_pos = palm_positions[0]
        end_pos = palm_positions[-1]
        dx = end_pos[0] - start_pos[0]
        dy = end_pos[1] - start_pos[1]
        
        # Minimum movement threshold
        min_movement = 0.15
        
        if abs(dx) > min_movement and abs(dx) > abs(dy) * 1.5:
            if dx > 0:
                return {'gesture': 'swipe_right', 'confidence': 0.80}
            else:
                return {'gesture': 'swipe_left', 'confidence': 0.80}
        
        if abs(dy) > min_movement and abs(dy) > abs(dx) * 1.5:
            if dy > 0:
                return {'gesture': 'swipe_down', 'confidence': 0.80}
            else:
                return {'gesture': 'swipe_up', 'confidence': 0.80}
        
        return None

    def process_camera_frame(self, frame):
        """Process a single camera frame for gesture detection"""
        try:
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Process the frame
            results = self.hands.process(rgb_frame)
            
            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    # Detect static gestures
                    gesture_result = self.detect_gesture(hand_landmarks.landmark)
                    
                    if gesture_result:
                        current_time = time.time()
                        
                        # Check cooldown
                        if current_time - self.last_gesture_time < self.gesture_cooldown:
                            continue
                        
                        # Check if same gesture is being held
                        if self.last_gesture == gesture_result['gesture']:
                            if self.gesture_start_time is None:
                                self.gesture_start_time = current_time
                            elif current_time - self.gesture_start_time >= self.gesture_hold_time:
                                # Gesture confirmed, send it
                                gesture_data = {
                                    'type': 'gesture',
                                    'gesture': gesture_result['gesture'],
                                    'confidence': gesture_result['confidence'],
                                    'timestamp': datetime.now().isoformat(),
                                    'detection_method': 'static'
                                }
                                
                                self.gesture_queue.put(gesture_data)
                                logger.info(f"Gesture detected: {gesture_result['gesture']} ({gesture_result['confidence']:.2f})")
                                
                                self.last_gesture_time = current_time
                                self.gesture_start_time = None
                        else:
                            self.last_gesture = gesture_result['gesture']
                            self.gesture_start_time = current_time
                    else:
                        # No gesture detected, reset
                        self.last_gesture = None
                        self.gesture_start_time = None
                        
                    # Send hand detected status
                    if len(self.clients) > 0:
                        asyncio.create_task(self.broadcast({
                            'type': 'hand_detected',
                            'timestamp': datetime.now().isoformat()
                        }))
            else:
                # No hands detected, reset
                if self.last_gesture is not None:
                    self.last_gesture = None
                    self.gesture_start_time = None
                    
                    # Send hand lost status
                    if len(self.clients) > 0:
                        asyncio.create_task(self.broadcast({
                            'type': 'hand_lost',
                            'timestamp': datetime.now().isoformat()
                        }))
                        
        except Exception as e:
            logger.error(f"Error processing camera frame: {e}")

    def camera_worker(self):
        """Camera capture worker thread"""
        try:
            cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                logger.error("Failed to open camera")
                return
            
            # Set camera properties
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cap.set(cv2.CAP_PROP_FPS, 30)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce buffer to minimize delay
            
            logger.info("Camera worker started")
            
            frame_count = 0
            while True:
                ret, frame = cap.read()
                if ret:
                    frame_count += 1
                    # Process every 2nd frame for performance
                    if frame_count % 2 == 0:
                        self.process_camera_frame(frame)
                else:
                    logger.error("Failed to capture camera frame")
                    time.sleep(0.1)
                    
        except Exception as e:
            logger.error(f"Camera worker error: {e}")
        finally:
            if 'cap' in locals():
                cap.release()

    async def gesture_broadcaster(self):
        """Broadcast detected gestures to connected clients"""
        while True:
            try:
                if not self.gesture_queue.empty():
                    gesture_data = self.gesture_queue.get_nowait()
                    logger.info(f"Broadcasting gesture: {gesture_data['gesture']}")
                    await self.broadcast(gesture_data)
                await asyncio.sleep(0.01)  # 100 FPS check rate
            except Exception as e:
                logger.error(f"Error in gesture broadcaster: {e}")
                await asyncio.sleep(0.1)

    async def handle_client_message(self, websocket, message):
        """Handle messages from clients"""
        try:
            data = json.loads(message)
            
            if data.get('type') == 'ping':
                await self.send_to_client(websocket, {
                    'type': 'pong',
                    'timestamp': datetime.now().isoformat()
                })
            elif data.get('type') == 'command':
                command = data.get('command')
                logger.info(f"Received command: {command}")
                
                if command == 'get_status':
                    await self.send_to_client(websocket, {
                        'type': 'status',
                        'message': 'Server running',
                        'active_clients': len(self.clients),
                        'last_gesture': self.last_gesture,
                        'timestamp': datetime.now().isoformat()
                    })
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {message}")
        except Exception as e:
            logger.error(f"Error handling client message: {e}")

    async def client_handler(self, websocket, path):
        """Handle individual client connections"""
        await self.register(websocket, path)
        try:
            async for message in websocket:
                await self.handle_client_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            logger.error(f"Error in client handler: {e}")
        finally:
            await self.unregister(websocket)

    def start_server(self):
        """Start the WebSocket server"""
        try:
            # Start camera worker thread
            camera_thread = threading.Thread(target=self.camera_worker, daemon=True)
            camera_thread.start()
            
            # Start WebSocket server
            logger.info(f"Starting WebSocket server on ws://{self.host}:{self.port}")
            logger.info("Make sure your camera is connected and not used by other applications")
            
            start_server = websockets.serve(
                self.client_handler,
                self.host,
                self.port,
                ping_interval=30,
                ping_timeout=10
            )
            
            # Start gesture broadcaster
            async def run_server():
                await asyncio.gather(
                    start_server,
                    self.gesture_broadcaster()
                )
            
            asyncio.run(run_server())
            
        except Exception as e:
            logger.error(f"Failed to start server: {e}")
            raise

if __name__ == "__main__":
    # Print system info
    print(f"Python version: {__import__('sys').version}")
    print(f"OpenCV version: {cv2.__version__}")
    print(f"MediaPipe version: {mp.__version__ if hasattr(mp, '__version__') else 'unknown'}")
    print(f"NumPy version: {np.__version__}")
    print("-" * 50)
    
    server = GestureWebSocketServer()
    try:
        server.start_server()
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        print(f"\nTroubleshooting:")
        print(f"1. Make sure MediaPipe is installed: pip install mediapipe")
        print(f"2. Make sure OpenCV is installed: pip install opencv-python")
        print(f"3. Check if camera is available and not used by other apps")
        print(f"4. Try reinstalling MediaPipe: pip uninstall mediapipe && pip install mediapipe")