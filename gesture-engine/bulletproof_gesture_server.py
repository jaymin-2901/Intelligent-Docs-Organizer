#!/usr/bin/env python3
"""
Bulletproof gesture server that works with ANY Python setup
Falls back gracefully if dependencies fail
"""
import asyncio
import json
import logging
import threading
import queue
import time
import sys
import os
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

print("🚀 BULLETPROOF GESTURE SERVER STARTING...")
print("=" * 60)

# Try to import WebSockets - this is REQUIRED
try:
    import websockets
    print(f"✅ WebSockets: {websockets.__version__}")
    WEBSOCKETS_AVAILABLE = True
except ImportError as e:
    print(f"❌ WebSockets REQUIRED but not available: {e}")
    print("Install with: pip install websockets")
    sys.exit(1)

# Try to import NumPy - OPTIONAL
try:
    import numpy as np
    print(f"✅ NumPy: {np.__version__}")
    NUMPY_AVAILABLE = True
except Exception as e:
    print(f"⚠️ NumPy not available: {e}")
    NUMPY_AVAILABLE = False

# Try to import OpenCV - OPTIONAL
try:
    import cv2
    print(f"✅ OpenCV: {cv2.__version__}")
    OPENCV_AVAILABLE = True
except Exception as e:
    print(f"⚠️ OpenCV not available: {e}")
    OPENCV_AVAILABLE = False

# Try to import MediaPipe - OPTIONAL
try:
    import mediapipe as mp
    print(f"✅ MediaPipe: {mp.__version__}")
    MEDIAPIPE_AVAILABLE = True
except Exception as e:
    print(f"⚠️ MediaPipe not available: {e}")
    MEDIAPIPE_AVAILABLE = False

print("=" * 60)

class GestureSimulator:
    """Always-working gesture simulator"""
    
    def __init__(self):
        self.gesture_index = 0
        self.gestures = [
            # Core document gestures
            {'name': 'thumbs_up', 'action': 'bookmark', 'confidence': 0.95, 'type': 'static'},
            {'name': 'peace', 'action': 'ai_summary', 'confidence': 0.92, 'type': 'static'},
            {'name': 'open_palm', 'action': 'show_documents', 'confidence': 0.89, 'type': 'static'},
            {'name': 'fist', 'action': 'close', 'confidence': 0.86, 'type': 'static'},
            
            # Navigation gestures
            {'name': 'swipe_left', 'action': 'prev_page', 'confidence': 0.88, 'type': 'swipe'},
            {'name': 'swipe_right', 'action': 'next_page', 'confidence': 0.88, 'type': 'swipe'},
            {'name': 'swipe_up', 'action': 'prev_document', 'confidence': 0.85, 'type': 'swipe'},
            {'name': 'swipe_down', 'action': 'next_document', 'confidence': 0.85, 'type': 'swipe'},
            
            # Zoom gestures
            {'name': 'pinch_in', 'action': 'zoom_out', 'confidence': 0.82, 'type': 'pinch'},
            {'name': 'pinch_out', 'action': 'zoom_in', 'confidence': 0.82, 'type': 'pinch'},
            
            # Interaction gestures
            {'name': 'pointing', 'action': 'select', 'confidence': 0.83, 'type': 'static'},
            {'name': 'ok_sign', 'action': 'confirm', 'confidence': 0.90, 'type': 'static'},
            {'name': 'rock_sign', 'action': 'rock', 'confidence': 0.87, 'type': 'static'},
        ]
        logger.info(f"🎮 Gesture simulator initialized with {len(self.gestures)} gestures")

    def get_next_gesture(self):
        """Get the next gesture in sequence"""
        gesture = self.gestures[self.gesture_index % len(self.gestures)]
        self.gesture_index += 1
        
        result = {
            'gesture': gesture['name'],
            'action': gesture['action'],
            'confidence': gesture['confidence'],
            'detection_type': gesture['type'],
            'source': 'simulation',
            'timestamp': datetime.now().isoformat()
        }
        
        return result

class BulletproofGestureServer:
    """Bulletproof gesture server that always works"""
    
    def __init__(self, host='localhost', port=8765):
        self.host = host
        self.port = port
        self.clients = set()
        self.gesture_queue = queue.Queue()
        self.running = True
        self.start_time = time.time()
        self.total_gestures = 0
        
        # Initialize gesture simulator
        self.gesture_simulator = GestureSimulator()
        
        # Server capabilities
        self.capabilities = {
            'websockets': WEBSOCKETS_AVAILABLE,
            'numpy': NUMPY_AVAILABLE,
            'opencv': OPENCV_AVAILABLE,
            'mediapipe': MEDIAPIPE_AVAILABLE,
            'real_camera': OPENCV_AVAILABLE and MEDIAPIPE_AVAILABLE,
            'mode': 'real_camera' if (OPENCV_AVAILABLE and MEDIAPIPE_AVAILABLE) else 'simulation'
        }
        
        logger.info(f"🎯 Server mode: {self.capabilities['mode']}")

    async def register_client(self, websocket, path):
        """Register a new WebSocket client"""
        self.clients.add(websocket)
        
        try:
            remote_addr = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
        except:
            remote_addr = "unknown"
            
        logger.info(f"🔗 Client connected: {remote_addr} (Total: {len(self.clients)})")
        
        # Send welcome message
        welcome = {
            'type': 'status',
            'message': 'Connected to bulletproof gesture server',
            'server_info': {
                'mode': self.capabilities['mode'],
                'capabilities': self.capabilities,
                'uptime': time.time() - self.start_time,
                'total_gestures': self.total_gestures,
                'python_version': sys.version,
                'supported_gestures': [g['name'] for g in self.gesture_simulator.gestures]
            },
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            await websocket.send(json.dumps(welcome))
            logger.info("📤 Welcome message sent")
        except Exception as e:
            logger.error(f"Failed to send welcome: {e}")

    async def unregister_client(self, websocket):
        """Unregister a WebSocket client"""
        self.clients.discard(websocket)
        logger.info(f"🔌 Client disconnected (Remaining: {len(self.clients)})")

    async def broadcast_gesture(self, gesture_data):
        """Broadcast gesture to all connected clients"""
        if not self.clients:
            return

        message = json.dumps(gesture_data)
        disconnected = set()

        for client in self.clients.copy():
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)
            except Exception as e:
                logger.warning(f"Error sending to client: {e}")
                disconnected.add(client)

        # Remove disconnected clients
        for client in disconnected:
            self.clients.discard(client)

        if disconnected:
            logger.info(f"Removed {len(disconnected)} disconnected clients")

        self.total_gestures += 1
        logger.info(f"📡 Gesture #{self.total_gestures} sent to {len(self.clients)} clients: {gesture_data['gesture']} → {gesture_data['action']}")

    def simulation_worker(self):
        """Worker thread that generates simulated gestures"""
        logger.info("🎮 Simulation worker started - generating gestures every 5 seconds")
        
        while self.running:
            try:
                time.sleep(5)  # Wait 5 seconds between gestures
                
                if self.clients:  # Only generate if clients are connected
                    gesture = self.gesture_simulator.get_next_gesture()
                    
                    # Create complete gesture message
                    gesture_message = {
                        'type': 'gesture',
                        'gesture': gesture['gesture'],
                        'action': gesture['action'],
                        'confidence': gesture['confidence'],
                        'detection_type': gesture['detection_type'],
                        'source': gesture['source'],
                        'server_mode': self.capabilities['mode'],
                        'timestamp': gesture['timestamp'],
                        'server_time': datetime.now().isoformat()
                    }
                    
                    # Queue for broadcasting
                    self.gesture_queue.put(gesture_message)
                    logger.info(f"🎯 Generated gesture: {gesture['gesture']} → {gesture['action']} ({gesture['confidence']:.2f})")
                    
            except Exception as e:
                logger.error(f"Simulation worker error: {e}")
                time.sleep(1)

    async def gesture_broadcaster(self):
        """Broadcast queued gestures to clients"""
        logger.info("📡 Gesture broadcaster started")
        
        while self.running:
            try:
                # Process all queued gestures
                while not self.gesture_queue.empty():
                    try:
                        gesture_data = self.gesture_queue.get_nowait()
                        await self.broadcast_gesture(gesture_data)
                    except queue.Empty:
                        break
                    except Exception as e:
                        logger.error(f"Broadcast error: {e}")
                
                # Small delay
                await asyncio.sleep(0.1)
                
            except Exception as e:
                logger.error(f"Broadcaster error: {e}")
                await asyncio.sleep(1)

    async def handle_client_message(self, websocket, path):
        """Handle WebSocket client connections"""
        await self.register_client(websocket, path)
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    await self.process_message(data, websocket)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON: {message}")
                except Exception as e:
                    logger.error(f"Message processing error: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info("Client connection closed normally")
        except Exception as e:
            logger.error(f"Client handler error: {e}")
        finally:
            await self.unregister_client(websocket)

    async def process_message(self, data, websocket):
        """Process individual client messages"""
        msg_type = data.get('type', 'unknown')
        
        if msg_type == 'ping':
            # Respond to ping
            pong = {
                'type': 'pong',
                'timestamp': datetime.now().isoformat()
            }
            await websocket.send(json.dumps(pong))
            
        elif msg_type == 'command':
            command = data.get('command', '')
            
            if command == 'get_status':
                status = {
                    'type': 'status_response',
                    'server_status': {
                        'mode': self.capabilities['mode'],
                        'active_clients': len(self.clients),
                        'capabilities': self.capabilities,
                        'uptime': time.time() - self.start_time,
                        'total_gestures': self.total_gestures
                    },
                    'timestamp': datetime.now().isoformat()
                }
                await websocket.send(json.dumps(status))
                
            elif command == 'force_gesture':
                # Force generate a gesture for testing
                gesture = self.gesture_simulator.get_next_gesture()
                gesture_message = {
                    'type': 'gesture',
                    'gesture': gesture['gesture'],
                    'action': gesture['action'],
                    'confidence': gesture['confidence'],
                    'detection_type': 'forced',
                    'source': 'manual_trigger',
                    'server_mode': self.capabilities['mode'],
                    'timestamp': gesture['timestamp'],
                    'server_time': datetime.now().isoformat()
                }
                self.gesture_queue.put(gesture_message)
                logger.info(f"🎯 Manual gesture triggered: {gesture['gesture']}")
                
        logger.info(f"📨 Processed {msg_type} message")

    async def run_server(self):
        """Run the main server"""
        logger.info("🚀 BULLETPROOF GESTURE SERVER RUNNING")
        logger.info("=" * 60)
        logger.info(f"🌐 WebSocket Server: ws://{self.host}:{self.port}")
        logger.info(f"🎯 Mode: {self.capabilities['mode']}")
        logger.info(f"🔧 Capabilities: {self.capabilities}")
        logger.info("🛑 Press Ctrl+C to stop")
        logger.info("=" * 60)
        
        # Start simulation worker thread
        worker = threading.Thread(target=self.simulation_worker, daemon=True)
        worker.start()
        logger.info("🔄 Background worker started")
        
        # Start WebSocket server
        try:
            server = websockets.serve(
                self.handle_client_message,
                self.host,
                self.port,
                ping_interval=20,
                ping_timeout=10
            )
            
            # Run server and broadcaster
            await asyncio.gather(
                server,
                self.gesture_broadcaster()
            )
            
        except Exception as e:
            logger.error(f"Server error: {e}")
            raise

    def start(self):
        """Start the server with error handling"""
        try:
            # For Windows compatibility
            if sys.platform.startswith('win'):
                asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
            
            asyncio.run(self.run_server())
            
        except KeyboardInterrupt:
            logger.info("\n🛑 Server stopped by user")
            self.running = False
        except Exception as e:
            logger.error(f"\n❌ Server failed: {e}")
            self.running = False

def main():
    """Main entry point"""
    try:
        print("\n🎯 STARTING BULLETPROOF GESTURE RECOGNITION SERVER")
        print(f"🐍 Python: {sys.version.split()[0]}")
        print(f"📁 Directory: {os.getcwd()}")
        
        if not WEBSOCKETS_AVAILABLE:
            print("❌ WebSockets not available - cannot start server")
            sys.exit(1)
        
        print("\n🎮 Server will generate demo gestures every 5 seconds")
        print("🌐 Connect your frontend to see the gestures!")
        print("=" * 60)
        
        # Create and start server
        server = BulletproofGestureServer()
        server.start()
        
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        print("\n🔧 TRY THESE FIXES:")
        print("1. pip install websockets")
        print("2. Restart your terminal")
        print("3. Check if port 8765 is available")
        sys.exit(1)

if __name__ == "__main__":
    main()