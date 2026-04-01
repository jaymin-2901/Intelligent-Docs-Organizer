"""
COMPLETE GESTURE DETECTION SERVER
Run this script to start the entire system
"""

import asyncio
import sys
import signal
import logging
from websocket_server import run_server

def setup_logging():
    """Setup comprehensive logging"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('gesture_detection.log')
        ]
    )

def signal_handler(signum, frame):
    """Handle Ctrl+C gracefully"""
    print("\n🛑 Shutting down gesture detection server...")
    sys.exit(0)

if __name__ == "__main__":
    # Setup
    setup_logging()
    signal.signal(signal.SIGINT, signal_handler)
    
    # Print startup info
    print("=" * 60)
    print("🎯 INTELLIGENT DOCUMENT ORGANIZER")
    print("   Gesture Detection Server")
    print("=" * 60)
    print("📋 Features:")
    print("   ✅ Hand tracking with MediaPipe")
    print("   ✅ 6 Static gestures (thumbs_up, peace, palm, fist, pinch, spread)")
    print("   ✅ 4 Swipe gestures (up, down, left, right)")
    print("   ✅ Real-time WebSocket communication")
    print("   ✅ Stability filtering and debouncing")
    print("   ✅ Debug visualization")
    print("=" * 60)
    
    # Run server
    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        print("\n✅ Server stopped successfully")
    except Exception as e:
        print(f"❌ Server error: {e}")
        sys.exit(1)