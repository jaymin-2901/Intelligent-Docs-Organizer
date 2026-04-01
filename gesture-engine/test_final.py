"""
Final compatibility test
"""
import sys
import os

print("🔍 System Information:")
print(f"Python: {sys.version}")
print(f"Platform: {sys.platform}")
print(f"Executable: {sys.executable}")

print("\n📦 Package Tests:")

# Test NumPy
try:
    import numpy as np
    print(f"✅ NumPy: {np.__version__}")
    
    # Test basic functionality
    arr = np.array([1, 2, 3])
    print(f"  - Array test: {arr}")
    
    # Check version compatibility
    version = tuple(map(int, np.__version__.split('.')[:2]))
    if version[0] >= 2:
        print("  ⚠️ WARNING: NumPy 2.x - may have issues")
    else:
        print(f"  ✅ NumPy 1.x - compatible")
        
except Exception as e:
    print(f"❌ NumPy failed: {e}")
    sys.exit(1)

# Test OpenCV
try:
    import cv2
    print(f"✅ OpenCV: {cv2.__version__}")
    
    # Test basic functionality
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    print(f"  - Image test: {img.shape}")
    
except Exception as e:
    print(f"❌ OpenCV failed: {e}")
    sys.exit(1)

# Test MediaPipe
try:
    import mediapipe as mp
    print(f"✅ MediaPipe: imported successfully")
    
    # Test hands module
    if hasattr(mp, 'solutions'):
        hands = mp.solutions.hands.Hands()
        print(f"  - Hands initialized (new API)")
    else:
        print(f"  - Using legacy API")
        
except Exception as e:
    print(f"❌ MediaPipe failed: {e}")
    sys.exit(1)

# Test WebSockets
try:
    import websockets
    print(f"✅ WebSockets: imported successfully")
except Exception as e:
    print(f"❌ WebSockets failed: {e}")
    sys.exit(1)

print("\n🎯 ALL TESTS PASSED!")
print("Ready to run gesture detection server.")