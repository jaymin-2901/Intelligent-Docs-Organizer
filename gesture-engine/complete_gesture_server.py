#!/usr/bin/env python3
"""
Complete MediaPipe-based gesture recognition WebSocket server
Supports real-time hand tracking and gesture detection
"""
import asyncio
import websockets
import json
import cv2
import logging
import threading
import queue
import time
import numpy as np
from datetime import datetime
from collections import deque
import math

# MediaPipe imports
try:
    import mediapipe as mp
    print(f"MediaPipe version: {mp.__version__}")
    
    # Initialize MediaPipe solutions
    mp_hands = mp.solutions.hands
    mp_drawing = mp.solutions.drawing_utils
    mp_drawing_styles = mp.solutions.drawing_styles
    MEDIAPIPE_AVAILABLE = True
    print("✅ MediaPipe loaded successfully")
    
except ImportError as e:
    print(f"❌ MediaPipe not available: {e}")
    MEDIAPIPE_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class GestureRecognitionEngine:
    """Advanced gesture recognition engine using MediaPipe"""
    
    def __init__(self):
        self.mp_hands = mp_hands
        self.hands = mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5
        )
        self.mp_drawing = mp_drawing
        
        # Gesture state tracking
        self.landmark_history = deque(maxlen=15)
        self.gesture_history = deque(maxlen=10)
        self.last_gesture = None
        self.gesture_start_time = None
        self.gesture_confidence_threshold = 0.8
        self.gesture_stability_frames = 5
        self.swipe_threshold = 0.15
        self.pinch_threshold = 0.08
        
        logger.info("Gesture Recognition Engine initialized")

    def calculate_landmarks(self, hand_landmarks):
        """Calculate normalized landmark positions"""
        landmarks = []
        for landmark in hand_landmarks.landmark:
            landmarks.append([landmark.x, landmark.y, landmark.z])
        return np.array(landmarks)

    def calculate_distances(self, landmarks):
        """Calculate key distances between landmarks"""
        if len(landmarks) < 21:
            return None
            
        # Key landmark indices
        thumb_tip = landmarks[4]
        thumb_ip = landmarks[3]
        thumb_mcp = landmarks[2]
        
        index_tip = landmarks[8]
        index_pip = landmarks[6]
        index_mcp = landmarks[5]
        
        middle_tip = landmarks[12]
        middle_pip = landmarks[10]
        middle_mcp = landmarks[9]
        
        ring_tip = landmarks[16]
        ring_pip = landmarks[14]
        ring_mcp = landmarks[13]
        
        pinky_tip = landmarks[20]
        pinky_pip = landmarks[18]
        pinky_mcp = landmarks[17]
        
        wrist = landmarks[0]
        
        def distance_3d(p1, p2):
            return np.sqrt(np.sum((p1 - p2) ** 2))
        
        def distance_2d(p1, p2):
            return np.sqrt((p1[0] - p2[0])**2 + (p1[1] - p2[1])**2)
        
        # Calculate finger tip to wrist distances (for finger extension detection)
        finger_distances = {
            'thumb': distance_2d(thumb_tip, wrist),
            'index': distance_2d(index_tip, wrist),
            'middle': distance_2d(middle_tip, wrist),
            'ring': distance_2d(ring_tip, wrist),
            'pinky': distance_2d(pinky_tip, wrist)
        }
        
        # Calculate finger tip to pip distances (for curl detection)
        finger_curls = {
            'thumb': distance_2d(thumb_tip, thumb_ip),
            'index': distance_2d(index_tip, index_pip),
            'middle': distance_2d(middle_tip, middle_pip),
            'ring': distance_2d(ring_tip, ring_pip),
            'pinky': distance_2d(pinky_tip, pinky_pip)
        }
        
        # Calculate special gesture distances
        thumb_index_distance = distance_2d(thumb_tip, index_tip)
        thumb_middle_distance = distance_2d(thumb_tip, middle_tip)
        index_middle_distance = distance_2d(index_tip, middle_tip)
        
        return {
            'finger_distances': finger_distances,
            'finger_curls': finger_curls,
            'thumb_index_distance': thumb_index_distance,
            'thumb_middle_distance': thumb_middle_distance,
            'index_middle_distance': index_middle_distance,
            'landmarks': landmarks
        }

    def detect_finger_states(self, landmarks):
        """Detect which fingers are extended or curled"""
        if len(landmarks) < 21:
            return None
            
        # Finger tip and joint positions
        fingers = {
            'thumb': {'tip': landmarks[4], 'ip': landmarks[3], 'mcp': landmarks[2]},
            'index': {'tip': landmarks[8], 'pip': landmarks[6], 'mcp': landmarks[5]},
            'middle': {'tip': landmarks[12], 'pip': landmarks[10], 'mcp': landmarks[9]},
            'ring': {'tip': landmarks[16], 'pip': landmarks[14], 'mcp': landmarks[13]},
            'pinky': {'tip': landmarks[20], 'pip': landmarks[18], 'mcp': landmarks[17]}
        }
        
        wrist = landmarks[0]
        
        finger_states = {}
        
        for finger_name, joints in fingers.items():
            if finger_name == 'thumb':
                # Thumb logic - different because thumb moves differently
                thumb_extended = joints['tip'][0] > joints['ip'][0]  # Thumb extends sideways
                thumb_up = joints['tip'][1] < joints['ip'][1] - 0.04  # Thumb points up
                finger_states[finger_name] = {
                    'extended': thumb_extended or thumb_up,
                    'up': thumb_up,
                    'curled': not (thumb_extended or thumb_up)
                }
            else:
                # Other fingers - extend upward
                extended = joints['tip'][1] < joints['pip'][1] - 0.02
                finger_states[finger_name] = {
                    'extended': extended,
                    'up': extended,
                    'curled': not extended
                }
        
        return finger_states

    def recognize_static_gesture(self, landmarks):
        """Recognize static hand gestures"""
        measurements = self.calculate_distances(landmarks)
        if not measurements:
            return None
            
        finger_states = self.detect_finger_states(landmarks)
        if not finger_states:
            return None
            
        # Count extended fingers
        extended_count = sum(1 for state in finger_states.values() if state['extended'])
        
        # Get specific finger states
        thumb_up = finger_states['thumb']['up']
        thumb_extended = finger_states['thumb']['extended']
        index_up = finger_states['index']['extended']
        middle_up = finger_states['middle']['extended']
        ring_up = finger_states['ring']['extended']
        pinky_up = finger_states['pinky']['extended']
        
        # Gesture recognition logic
        
        # 1. THUMBS UP - Only thumb pointing up, others curled
        if thumb_up and not any([index_up, middle_up, ring_up, pinky_up]):
            return {'gesture': 'thumbs_up', 'confidence': 0.95}
        
        # 2. PEACE SIGN - Index and middle up, others down
        if index_up and middle_up and not any([thumb_extended, ring_up, pinky_up]):
            return {'gesture': 'peace', 'confidence': 0.92}
        
        # 3. POINTING - Only index finger up
        if index_up and not any([thumb_extended, middle_up, ring_up, pinky_up]):
            return {'gesture': 'pointing', 'confidence': 0.90}
        
        # 4. OK SIGN - Thumb and index forming circle, others extended
        thumb_index_dist = measurements['thumb_index_distance']
        if (thumb_index_dist < 0.06 and middle_up and ring_up and pinky_up):
            return {'gesture': 'ok_sign', 'confidence': 0.88}
        
        # 5. ROCK/HORN - Index and pinky up, middle and ring down
        if index_up and pinky_up and not middle_up and not ring_up:
            return {'gesture': 'rock_sign', 'confidence': 0.85}
        
        # 6. OPEN PALM - Most or all fingers extended
        if extended_count >= 4:
            return {'gesture': 'open_palm', 'confidence': 0.85}
        
        # 7. FIST - All fingers curled
        if extended_count <= 1:
            return {'gesture': 'fist', 'confidence': 0.83}
        
        # 8. PINCH - Thumb and index very close
        if thumb_index_dist < 0.05:
            if extended_count <= 2:
                return {'gesture': 'pinch_close', 'confidence': 0.80}
            else:
                return {'gesture': 'pinch_open', 'confidence': 0.80}
        
        # 9. THREE - Three fingers up (index, middle, ring)
        if index_up and middle_up and ring_up and not pinky_up and not thumb_extended:
            return {'gesture': 'three', 'confidence': 0.85}
        
        # 10. FOUR - Four fingers up (index, middle, ring, pinky)
        if index_up and middle_up and ring_up and pinky_up and not thumb_extended:
            return {'gesture': 'four', 'confidence': 0.85}
        
        return None

    def detect_swipe_gesture(self):
        """Detect swipe gestures based on hand movement history"""
        if len(self.landmark_history) < 8:
            return None
        
        # Get hand center positions from recent frames
        hand_centers = []
        for landmarks in self.landmark_history:
            if landmarks is not None:
                # Calculate hand center (average of key landmarks)
                wrist = landmarks[0]
                middle_mcp = landmarks[9]
                center = [(wrist[0] + middle_mcp[0]) / 2, (wrist[1] + middle_mcp[1]) / 2]
                hand_centers.append(center)
        
        if len(hand_centers) < 5:
            return None
        
        # Calculate movement vector
        start_pos = hand_centers[0]
        end_pos = hand_centers[-1]
        
        dx = end_pos[0] - start_pos[0]
        dy = end_pos[1] - start_pos[1]
        
        # Calculate movement magnitude
        movement_magnitude = np.sqrt(dx**2 + dy**2)
        
        if movement_magnitude < self.swipe_threshold:
            return None
        
        # Determine swipe direction
        angle = math.atan2(dy, dx)
        angle_degrees = math.degrees(angle)
        
        # Normalize angle to 0-360
        if angle_degrees < 0:
            angle_degrees += 360
        
        # Determine swipe direction based on angle
        if 45 <= angle_degrees < 135:
            return {'gesture': 'swipe_down', 'confidence': 0.85}
        elif 135 <= angle_degrees < 225:
            return {'gesture': 'swipe_left', 'confidence': 0.85}
        elif 225 <= angle_degrees < 315:
            return {'gesture': 'swipe_up', 'confidence': 0.85}
        else:  # 315-45 degrees
            return {'gesture': 'swipe_right', 'confidence': 0.85}

    def detect_pinch_gesture(self):
        """Detect pinch in/out gestures based on distance changes"""
        if len(self.landmark_history) < 6:
            return None
        
        # Calculate thumb-index distances for recent frames
        distances = []
        for landmarks in self.landmark_history:
            if landmarks is not None and len(landmarks) >= 21:
                thumb_tip = landmarks[4]
                index_tip = landmarks[8]
                dist = np.sqrt((thumb_tip[0] - index_tip[0])**2 + (thumb_tip[1] - index_tip[1])**2)
                distances.append(dist)
        
        if len(distances) < 4:
            return None
        
        # Calculate distance change trend
        early_avg = np.mean(distances[:len(distances)//2])
        late_avg = np.mean(distances[len(distances)//2:])
        
        distance_change = late_avg - early_avg
        
        # Significant pinch in (distance decreasing)
        if distance_change < -0.03:
            return {'gesture': 'pinch_in', 'confidence': 0.82}
        
        # Significant pinch out (distance increasing)
        if distance_change > 0.03:
            return {'gesture': 'pinch_out', 'confidence': 0.82}
        
        return None

    def process_landmarks(self, hand_landmarks):
        """Process hand landmarks and detect gestures"""
        landmarks = self.calculate_landmarks(hand_landmarks)
        self.landmark_history.append(landmarks)
        
        # Try static gesture recognition first
        static_gesture = self.recognize_static_gesture(landmarks)
        
        # Try dynamic gesture recognition
        swipe_gesture = self.detect_swipe_gesture()
        pinch_gesture = self.detect_pinch_gesture()
        
        # Priority: static > swipe > pinch
        detected_gesture = static_gesture or swipe_gesture or pinch_gesture
        
        if detected_gesture:
            # Add to gesture history for stability checking
            self.gesture_history.append(detected_gesture)
            
            # Check for gesture stability
            recent_gestures = list(self.gesture_history)[-self.gesture_stability_frames:]
            
            if len(recent_gestures) >= 3:
                # Check if recent gestures are consistent
                gesture_names = [g['gesture'] for g in recent_gestures]
                most_common = max(set(gesture_names), key=gesture_names.count)
                
                if gesture_names.count(most_common) >= 2:
                    # Calculate average confidence
                    confidences = [g['confidence'] for g in recent_gestures if g['gesture'] == most_common]
                    avg_confidence = np.mean(confidences)
                    
                    if avg_confidence >= self.gesture_confidence_threshold:
                        return {
                            'gesture': most_common,
                            'confidence': avg_confidence,
                            'type': 'static' if static_gesture else ('swipe' if swipe_gesture else 'pinch')
                        }
        
        return None

class CompleteGestureServer:
    """Complete WebSocket server with MediaPipe gesture recognition"""
    
    def __init__(self, host='localhost', port=8765):
        self.host = host
        self.port = port
        self.clients = set()
        self.gesture_queue = queue.Queue()
        self.camera_active = False
        self.server_running = True
        
        # Initialize gesture recognition engine
        if MEDIAPIPE_AVAILABLE:
            self.gesture_engine = GestureRecognitionEngine()
        else:
            self.gesture_engine = None
            logger.error("MediaPipe not available - server will run in simulation mode")
        
        # Gesture timing control
        self.last_gesture_time = 0
        self.gesture_cooldown = 1.2  # seconds between gesture detections
        
        logger.info(f"Complete Gesture Server initialized on {host}:{port}")

    async def register_client(self, websocket, path):
        """Register a new client connection"""
        self.clients.add(websocket)
        client_info = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        logger.info(f"Client connected: {client_info} (Total: {len(self.clients)})")
        
        # Send welcome message with server capabilities
        welcome_msg = {
            'type': 'status',
            'message': 'Connected to complete gesture recognition server',
            'server_capabilities': {
                'mediapipe_available': MEDIAPIPE_AVAILABLE,
                'camera_active': self.camera_active,
                'supported_gestures': [
                    'thumbs_up', 'peace', 'pointing', 'ok_sign', 'rock_sign',
                    'open_palm', 'fist', 'pinch_close', 'pinch_open', 'three', 'four',
                    'swipe_up', 'swipe_down', 'swipe_left', 'swipe_right',
                    'pinch_in', 'pinch_out'
                ]
            },
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            await websocket.send(json.dumps(welcome_msg))
        except Exception as e:
            logger.error(f"Error sending welcome message: {e}")

    async def unregister_client(self, websocket):
        """Unregister a client connection"""
        self.clients.discard(websocket)
        logger.info(f"Client disconnected (Remaining: {len(self.clients)})")

    async def broadcast_to_clients(self, message):
        """Broadcast message to all connected clients"""
        if not self.clients:
            return
            
        clients_copy = self.clients.copy()
        
        for client in clients_copy:
            try:
                await client.send(json.dumps(message))
            except websockets.exceptions.ConnectionClosed:
                self.clients.discard(client)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                self.clients.discard(client)

    def camera_worker(self):
        """Camera capture and gesture detection worker thread"""
        if not MEDIAPIPE_AVAILABLE:
            logger.warning("Camera worker starting in simulation mode")
            self.simulation_worker()
            return
            
        try:
            # Initialize camera
            cap = cv2.VideoCapture(0)
            
            if not cap.isOpened():
                logger.error("Failed to open camera - switching to simulation mode")
                self.simulation_worker()
                return
            
            # Set camera properties for optimal performance
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cap.set(cv2.CAP_PROP_FPS, 30)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Reduce latency
            
            self.camera_active = True
            logger.info("Camera worker started - Real-time gesture detection active")
            
            frame_count = 0
            last_fps_time = time.time()
            
            while self.server_running:
                ret, frame = cap.read()
                
                if not ret:
                    logger.error("Failed to capture frame")
                    time.sleep(0.1)
                    continue
                
                frame_count += 1
                
                # Process every 2nd frame for performance
                if frame_count % 2 == 0:
                    self.process_camera_frame(frame)
                
                # Log FPS every 100 frames
                if frame_count % 100 == 0:
                    current_time = time.time()
                    fps = 100 / (current_time - last_fps_time)
                    logger.info(f"Camera FPS: {fps:.1f}")
                    last_fps_time = current_time
                
        except Exception as e:
            logger.error(f"Camera worker error: {e}")
        finally:
            if 'cap' in locals():
                cap.release()
            self.camera_active = False
            logger.info("Camera worker stopped")

    def process_camera_frame(self, frame):
        """Process a single camera frame for gesture detection"""
        try:
            # Convert BGR to RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Process with MediaPipe
            results = self.gesture_engine.hands.process(rgb_frame)
            
            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    # Process landmarks with gesture engine
                    gesture_result = self.gesture_engine.process_landmarks(hand_landmarks)
                    
                    if gesture_result:
                        current_time = time.time()
                        
                        # Apply cooldown to prevent gesture spam
                        if current_time - self.last_gesture_time >= self.gesture_cooldown:
                            self.queue_gesture(gesture_result)
                            self.last_gesture_time = current_time
            else:
                # No hands detected - clear history
                if hasattr(self.gesture_engine, 'landmark_history'):
                    self.gesture_engine.landmark_history.clear()
                    self.gesture_engine.gesture_history.clear()
                    
        except Exception as e:
            logger.error(f"Error processing camera frame: {e}")

    def queue_gesture(self, gesture_result):
        """Queue detected gesture for broadcasting"""
        gesture_data = {
            'type': 'gesture',
            'gesture': gesture_result['gesture'],
            'confidence': gesture_result['confidence'],
            'detection_type': gesture_result.get('type', 'static'),
            'timestamp': datetime.now().isoformat(),
            'server_mode': 'mediapipe'
        }
        
        self.gesture_queue.put(gesture_data)
        logger.info(f"🎯 Gesture detected: {gesture_result['gesture']} "
                   f"(confidence: {gesture_result['confidence']:.2f}, "
                   f"type: {gesture_result.get('type', 'static')})")

    def simulation_worker(self):
        """Fallback simulation worker when camera/MediaPipe unavailable"""
        logger.info("Simulation worker started - Gestures will be simulated")
        
        gestures = [
            {'gesture': 'thumbs_up', 'confidence': 0.95, 'type': 'static'},
            {'gesture': 'peace', 'confidence': 0.92, 'type': 'static'},
            {'gesture': 'open_palm', 'confidence': 0.85, 'type': 'static'},
            {'gesture': 'fist', 'confidence': 0.83, 'type': 'static'},
            {'gesture': 'swipe_left', 'confidence': 0.85, 'type': 'swipe'},
            {'gesture': 'swipe_right', 'confidence': 0.85, 'type': 'swipe'},
            {'gesture': 'pinch_in', 'confidence': 0.82, 'type': 'pinch'},
            {'gesture': 'pinch_out', 'confidence': 0.82, 'type': 'pinch'}
        ]
        
        gesture_index = 0
        
        while self.server_running:
            time.sleep(12)  # Simulate gesture every 12 seconds
            
            if self.clients:
                current_gesture = gestures[gesture_index % len(gestures)]
                
                gesture_data = {
                    'type': 'gesture',
                    'gesture': current_gesture['gesture'],
                    'confidence': current_gesture['confidence'],
                    'detection_type': current_gesture['type'],
                    'timestamp': datetime.now().isoformat(),
                    'server_mode': 'simulation'
                }
                
                self.gesture_queue.put(gesture_data)
                logger.info(f"🎯 Simulated gesture: {current_gesture['gesture']}")
                
                gesture_index += 1

    async def gesture_broadcaster(self):
        """Broadcast detected gestures to all clients"""
        logger.info("Gesture broadcaster started")
        
        while self.server_running:
            try:
                if not self.gesture_queue.empty():
                    gesture_data = self.gesture_queue.get_nowait()
                    
                    # Map gesture names to actions for frontend compatibility
                    action_map = {
                        'thumbs_up': 'bookmark',
                        'peace': 'ai_summary',
                        'open_palm': 'show_documents',
                        'fist': 'close',
                        'swipe_left': 'prev_page',
                        'swipe_right': 'next_page',
                        'swipe_up': 'prev_document',
                        'swipe_down': 'next_document',
                        'pinch_in': 'zoom_out',
                        'pinch_out': 'zoom_in',
                        'pointing': 'select',
                        'ok_sign': 'confirm',
                        'rock_sign': 'rock',
                        'three': 'three',
                        'four': 'four'
                    }
                    
                    # Add action to gesture data
                    gesture_data['action'] = action_map.get(gesture_data['gesture'], gesture_data['gesture'])
                    
                    logger.info(f"📡 Broadcasting: {gesture_data['gesture']} → {gesture_data['action']}")
                    await self.broadcast_to_clients(gesture_data)
                    
                await asyncio.sleep(0.01)  # High frequency checking
                
            except Exception as e:
                logger.error(f"Error in gesture broadcaster: {e}")
                await asyncio.sleep(0.1)

    async def handle_client_messages(self, websocket, path):
        """Handle messages from connected clients"""
        await self.register_client(websocket, path)
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    message_type = data.get('type', 'unknown')
                    
                    if message_type == 'ping':
                        # Respond to ping with pong
                        pong_response = {
                            'type': 'pong',
                            'timestamp': datetime.now().isoformat()
                        }
                        await websocket.send(json.dumps(pong_response))
                        
                    elif message_type == 'command':
                        command = data.get('command', '')
                        
                        if command == 'get_status':
                            status_response = {
                                'type': 'status',
                                'message': 'Server running normally',
                                'server_status': {
                                    'active_clients': len(self.clients),
                                    'camera_active': self.camera_active,
                                    'mediapipe_available': MEDIAPIPE_AVAILABLE,
                                    'server_mode': 'mediapipe' if MEDIAPIPE_AVAILABLE and self.camera_active else 'simulation',
                                    'uptime': time.time()
                                },
                                'timestamp': datetime.now().isoformat()
                            }
                            await websocket.send(json.dumps(status_response))
                            
                        elif command == 'reset_gesture_history':
                            if self.gesture_engine:
                                self.gesture_engine.landmark_history.clear()
                                self.gesture_engine.gesture_history.clear()
                            logger.info("Gesture history reset by client command")
                            
                    else:
                        logger.info(f"Unknown message type: {message_type}")
                        
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON received: {message}")
                except Exception as e:
                    logger.error(f"Error processing client message: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info("Client connection closed normally")
        except Exception as e:
            logger.error(f"Client handler error: {e}")
        finally:
            await self.unregister_client(websocket)

    async def run_server(self):
        """Run the complete gesture recognition server"""
        logger.info(f"🚀 Starting Complete Gesture Recognition Server")
        logger.info(f"📡 WebSocket server: ws://{self.host}:{self.port}")
        logger.info(f"📷 MediaPipe available: {MEDIAPIPE_AVAILABLE}")
        logger.info(f"🎯 Gesture detection: {'Real-time' if MEDIAPIPE_AVAILABLE else 'Simulation'}")
        logger.info("🛑 Press Ctrl+C to stop server")
        logger.info("=" * 60)
        
        # Start camera/simulation worker thread
        camera_thread = threading.Thread(target=self.camera_worker, daemon=True)
        camera_thread.start()
        
        # Start WebSocket server
        start_server = websockets.serve(
            self.handle_client_messages,
            self.host,
            self.port,
            ping_interval=30,  # Send ping every 30 seconds
            ping_timeout=10    # Wait 10 seconds for pong
        )
        
        # Run server and gesture broadcaster concurrently
        try:
            await asyncio.gather(
                start_server,
                self.gesture_broadcaster()
            )
        except Exception as e:
            logger.error(f"Server error: {e}")
            raise

    def start(self):
        """Start the server"""
        try:
            asyncio.run(self.run_server())
        except KeyboardInterrupt:
            logger.info("\n🛑 Server stopped by user")
            self.server_running = False
        except Exception as e:
            logger.error(f"\n❌ Server startup error: {e}")
            self.server_running = False

def main():
    """Main entry point"""
    print("=" * 80)
    print("🎯 COMPLETE GESTURE RECOGNITION WEBSOCKET SERVER")
    print("=" * 80)
    print(f"🐍 Python: {__import__('sys').version.split()[0]}")
    print(f"🖥️  OpenCV: {cv2.__version__}")
    print(f"🤖 MediaPipe: {mp.__version__ if MEDIAPIPE_AVAILABLE else 'Not Available'}")
    print(f"🌐 NumPy: {np.__version__}")
    print(f"📡 WebSockets: Available")
    print("=" * 80)
    
    if not MEDIAPIPE_AVAILABLE:
        print("⚠️  WARNING: MediaPipe not available - running in simulation mode")
        print("   Install MediaPipe for real gesture recognition: pip install mediapipe")
        print("=" * 80)
    
    # Create and start server
    server = CompleteGestureServer()
    server.start()

if __name__ == "__main__":
    main()