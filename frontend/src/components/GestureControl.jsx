import React, { useState, useEffect, useRef } from 'react';

const GestureControl = ({ onGesture }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastGesture, setLastGesture] = useState(null);
  const videoRef = useRef(null);
  const animationRef = useRef(null);

  const PYTHON_API = 'http://localhost:5001';

  const startGestureDetection = async () => {
    try {
      const response = await fetch(`${PYTHON_API}/gesture/start`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        setIsEnabled(true);
        setIsStreaming(true);
      } else {
        alert('Could not start camera: ' + data.message);
      }
    } catch (error) {
      console.error('Failed to start gesture detection:', error);
      alert('Failed to connect to gesture service');
    }
  };

  const stopGestureDetection = async () => {
    try {
      await fetch(`${PYTHON_API}/gesture/stop`, { method: 'POST' });
      setIsEnabled(false);
      setIsStreaming(false);
    } catch (error) {
      console.error('Failed to stop gesture detection:', error);
    }
  };

  useEffect(() => {
    return () => {
      if (isEnabled) {
        stopGestureDetection();
      }
    };
    // eslint-disable-next-line
  }, []);

  return (
    <div className="gesture-control">
      <div className="gesture-header">
        <h3>🖐️ Gesture Control</h3>
        <button 
          className={`btn-${isEnabled ? 'danger' : 'primary'}`}
          onClick={isEnabled ? stopGestureDetection : startGestureDetection}
        >
          {isEnabled ? '⏹️ Stop' : '▶️ Start'} Gestures
        </button>
      </div>

      {isEnabled && (
        <div className="gesture-content">
          <div className="video-container">
            <img 
              ref={videoRef}
              src={`${PYTHON_API}/gesture/video-feed?${Date.now()}`}
              alt="Gesture Feed"
              className="gesture-video"
            />
            <div className="video-overlay">
              <span className="live-indicator">● LIVE</span>
            </div>
          </div>

          <div className="gesture-info">
            <div className="current-gesture">
              <strong>Last Gesture:</strong>
              <span className="gesture-name">
                {lastGesture ? lastGesture.type : 'None'}
              </span>
            </div>

            <div className="gesture-legend">
              <h4>Available Gestures:</h4>
              <ul>
                <li>👋 <strong>Left Movement</strong> (open palm) → Next Page</li>
                <li>👋 <strong>Right Movement</strong> (open/closed hand) → Previous Page</li>
                <li>⬆️⬇️ <strong>Up/Down Movement</strong> → Scroll</li>
                <li>🤏 <strong>Pinch In/Out</strong> → Zoom Out/In</li>
                <li>👌 <strong>OK Sign</strong> → Reset Zoom (100%)</li>
                <li>✌️ <strong>Peace Sign</strong> → Generate AI Summary</li>
                <li>👆 <strong>Pointing</strong> → Next Document</li>
                <li>🤘 <strong>Rock/YoYo</strong> → Fullscreen</li>
                <li>3️⃣ <strong>Three Fingers</strong> → Gesture Guide</li>
                <li>4️⃣ <strong>Four Fingers</strong> → Analytics</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {!isEnabled && (
        <div className="gesture-disabled">
          <p>Enable gesture control to navigate documents with hand movements!</p>
          <div className="gesture-preview">
            <span>👋 Swipe</span>
            <span>👍 Thumbs Up</span>
            <span>✌️ Peace</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestureControl;