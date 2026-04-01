#!/usr/bin/env python3
import asyncio
import websockets
import json
import time
from datetime import datetime

class SimpleGestureServer:
    def __init__(self, host='localhost', port=8765):
        self.host = host
        self.port = port
        self.clients = set()
        
    async def register(self, websocket, path):
        self.clients.add(websocket)
        print(f"Client connected: {websocket.remote_address}")
        
        await websocket.send(json.dumps({
            'type': 'status',
            'message': 'Connected to simple gesture server (MediaPipe fallback)',
            'timestamp': datetime.now().isoformat()
        }))

    async def unregister(self, websocket):
        self.clients.discard(websocket)
        print(f"Client disconnected: {websocket.remote_address}")

    async def simulate_gestures(self):
        """Simulate gestures for testing"""
        gestures = ['thumbs_up', 'peace', 'open_palm', 'fist']
        
        while True:
            await asyncio.sleep(10)  # Wait 10 seconds
            
            if self.clients:
                gesture = gestures[int(time.time()) % len(gestures)]
                
                data = {
                    'type': 'gesture',
                    'gesture': gesture,
                    'confidence': 0.85,
                    'timestamp': datetime.now().isoformat(),
                    'detection_method': 'simulated'
                }
                
                print(f"Simulating gesture: {gesture}")
                
                await asyncio.gather(
                    *[client.send(json.dumps(data)) for client in self.clients.copy()],
                    return_exceptions=True
                )

    async def client_handler(self, websocket, path):
        await self.register(websocket, path)
        try:
            async for message in websocket:
                data = json.loads(message)
                if data.get('type') == 'ping':
                    await websocket.send(json.dumps({
                        'type': 'pong',
                        'timestamp': datetime.now().isoformat()
                    }))
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await self.unregister(websocket)

    def start_server(self):
        print(f"Starting simple gesture server on ws://{self.host}:{self.port}")
        print("This server simulates gestures every 10 seconds for testing")
        
        start_server = websockets.serve(self.client_handler, self.host, self.port)
        
        asyncio.run(asyncio.gather(
            start_server,
            self.simulate_gestures()
        ))

if __name__ == "__main__":
    server = SimpleGestureServer()
    server.start_server()