from flask import Blueprint, Response, jsonify
import cv2
import numpy as np
import time
import threading
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

gesture_routes = Blueprint('gesture', __name__)

# Global state
camera = None
camera_lock = threading.Lock()
is_streaming = False
current_gesture = None
last_gesture_time = 0

def get_camera():
    global camera
    with camera_lock:
        if camera is None or not camera.isOpened():
            # Try different camera indices
            for i in range(3):
                camera = cv2.VideoCapture(i)
                if camera.isOpened():
                    camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                    print(f"📷 Camera opened at index {i}")
                    break
            else:
                print("❌ No camera found")
    return camera

def release_camera():
    global camera
    with camera_lock:
        if camera is not None:
            camera.release()
            camera = None

@gesture_routes.route('/start', methods=['POST'])
def start_camera():
    global is_streaming, current_gesture
    try:
        cam = get_camera()
        if cam is not None and cam.isOpened():
            is_streaming = True
            current_gesture = None
            return jsonify({
                'success': True, 
                'message': 'Camera started',
                'is_streaming': True
            })
        return jsonify({'success': False, 'message': 'Could not open camera. Check if camera is connected.'}), 500
    except Exception as e:
        print(f"Error starting camera: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@gesture_routes.route('/stop', methods=['POST'])
def stop_camera():
    global is_streaming, current_gesture
    is_streaming = False
    current_gesture = None
    release_camera()
    return jsonify({'success': True, 'message': 'Camera stopped'})

@gesture_routes.route('/video-feed')
def video_feed():
    """Stream video with gesture detection overlay"""
    global is_streaming, current_gesture, last_gesture_time
    
    def generate():
        global current_gesture, last_gesture_time
        
        # Import gesture detector
        try:
            from utils.gesture_detector import gesture_detector
            use_gesture = True
        except Exception as e:
            print(f"Gesture detector import error: {e}")
            use_gesture = False
        
        cam = get_camera()
        
        if cam is None or not cam.isOpened():
            # Return placeholder frame
            frame = create_placeholder_frame("📷 Camera not available\nCheck connection")
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            return
        
        frame_count = 0
        last_gesture_time = time.time()
        
        while is_streaming:
            success, frame = cam.read()
            if not success:
                frame = create_placeholder_frame("📷 Reading frame failed")
                yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
                continue
            
            # Flip frame horizontally (mirror effect)
            frame = cv2.flip(frame, 1)
            frame_count += 1
            
            # Detect gestures every 3rd frame
            if use_gesture and frame_count % 3 == 0:
                try:
                    gesture_data, processed_frame = gesture_detector.detect(frame)
                    frame = processed_frame
                    
                    if gesture_data.get('gestures'):
                        new_gesture = gesture_data['gestures'][0].get('type')
                        current_time = time.time()
                        
                        # Only update if cooldown passed
                        if current_time - last_gesture_time > 1.5:
                            current_gesture = new_gesture
                            last_gesture_time = current_time
                            print(f"🖐️ Gesture detected: {new_gesture}")
                except Exception as e:
                    print(f"Detection error: {e}")
            
            # Draw status overlay
            cv2.rectangle(frame, (0, 0), (frame.shape[1], 50), (0, 0, 0), -1)
            cv2.putText(frame, "🖐️ Gesture Mode Active", (10, 35),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            
            if current_gesture:
                cv2.putText(frame, f"Detected: {current_gesture}", (400, 35),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
            
            # Draw gesture guide
            cv2.rectangle(frame, (0, frame.shape[0] - 80), (frame.shape[1], frame.shape[0]), (0, 0, 0), -1)
            cv2.putText(frame, "1 finger=Thumbs Up | 2 fingers=Peace | Open hand=Palm | Fist=Close", 
                       (10, frame.shape[0] - 50), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            cv2.putText(frame, "Show your hand clearly in the camera view", 
                       (10, frame.shape[0] - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
            
            # Encode frame
            ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
    
    return Response(generate(), mimetype='multipart/x-mixed-replace; boundary=frame')

@gesture_routes.route('/status', methods=['GET'])
def get_status():
    global is_streaming, camera, current_gesture
    return jsonify({
        'success': True,
        'is_streaming': is_streaming,
        'camera_available': camera is not None and camera.isOpened() if camera else False,
        'current_gesture': current_gesture
    })

@gesture_routes.route('/current', methods=['GET'])
def get_current_gesture():
    global current_gesture
    gesture = current_gesture
    # Don't reset - let frontend handle it
    return jsonify({
        'success': True,
        'gesture': gesture
    })

@gesture_routes.route('/reset', methods=['POST'])
def reset_gesture():
    global current_gesture
    current_gesture = None
    return jsonify({'success': True})


def create_placeholder_frame(message):
    """Create a placeholder image when camera is unavailable"""
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Add gradient background
    for i in range(480):
        frame[i] = [i//4, i//6, 50]
    
    # Add text
    lines = message.split('\n')
    y = 200
    for line in lines:
        cv2.putText(frame, line, (170, y), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        y += 40
    
    ret, buffer = cv2.imencode('.jpg', frame)
    return buffer.tobytes()