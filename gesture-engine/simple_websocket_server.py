"""
Simple WebSocket server without MediaPipe
"""

import asyncio
import websockets
import json
import time
import logging
from main_simple import SimpleGestureEngine

class SimpleWebSocketServer:
    def __init__(self):
        self.clients = set()
        self.gesture_engine = None
        self.logger = logging.getLogger(__name__)
        
    async def start_server(self):
        """Start simple server"""
        try:
            # Start gesture engine
            self.gesture_engine = SimpleGestureEngine(
                detection_callback=self._on_gesture_detected,
                debug_mode=True
            )
            
            if not self.gesture_engine.start():
                raise Exception("Failed to start gesture engine")
            
            # Start WebSocket server
            server = await websockets.serve(self.handle_client, "localhost", 8765)
            self.logger.info("Simple server started on ws://localhost:8765")
            
            return server
            
        except Exception as e:
            self.logger.error(f"Failed to start server: {e}")
            raise
    
    async def handle_client(self, websocket, path):
        """Handle client connection"""
        try:
            self.clients.add(websocket)
            print(f"Client connected: {websocket.remote_address}")
            
            # Send welcome message
            await websocket.send(json.dumps({
                'type': 'connection',
                'message': 'Simple gesture server connected',
                'timestamp': time.time()
            }))
            
            # Handle messages
            async for message in websocket:
                data = json.loads(message)
                if data.get('type') == 'ping':
                    await websocket.send(json.dumps({
                        'type': 'pong',
                        'timestamp': time.time()
                    }))
                    
        except websockets.exceptions.ConnectionClosed:
            print("Client disconnected")
        finally:
            self.clients.discard(websocket)
    
    def _on_gesture_detected(self, result):
        """Handle gesture detection"""
        if result.gesture != "none":
            print(f"Gesture: {result.gesture} (confidence: {result.confidence:.2f})")
            
            # Send to clients
            message = {
                'type': 'gesture_detection',
                'data': {
                    'gesture': {
                        'name': result.gesture,
                        'confidence': result.confidence,
                        'action': self._get_action(result.gesture)
                    }
                },
                'timestamp': result.timestamp
            }
            
            # Broadcast to all clients
            asyncio.create_task(self._broadcast(message))
    
    def _get_action(self, gesture):
        """Map gesture to action"""
        actions = {
            'thumbs_up': 'bookmark',
            'peace': 'ai_summary',
            'open_palm': 'show_documents',
            'fist': 'close'
        }
        return actions.get(gesture, 'unknown')
    
    async def _broadcast(self, message):
        """Broadcast to all clients"""
        if self.clients:
            await asyncio.gather(
                *[client.send(json.dumps(message)) for client in self.clients],
                return_exceptions=True
            )

# Run simple server
async def run_simple_server():
    server_instance = SimpleWebSocketServer()
    try:
        server = await server_instance.start_server()
        print("🚀 Simple Gesture Server running!")
        print("📡 Connect to: ws://localhost:8765")
        print("🛑 Press Ctrl+C to stop")
        
        await server.wait_closed()
        
    except KeyboardInterrupt:
        print("\nStopping server...")
    except Exception as e:
        print(f"Server error: {e}")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_simple_server())