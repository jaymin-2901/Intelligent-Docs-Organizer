import React, { useRef, useEffect, useState, useCallback } from 'react';
import './GestureRecognition.css';

// ════════════════════════════════════════════════════════════════
// ✅ CHANGE 1: SWIPE_UP → scrollUp, SWIPE_DOWN → scrollDown
// ════════════════════════════════════════════════════════════════
const GESTURES = {
  PINCH_IN:     { name: 'Pinch In',       emoji: '🤏', action: 'zoomOut',       description: 'Zoom Out',           priority: 1 },
  PINCH_OUT:    { name: 'Pinch Out',      emoji: '🔍', action: 'zoomIn',        description: 'Zoom In',            priority: 1 },
  SWIPE_LEFT:   { name: 'Palm Move Left', emoji: '◀️', action: 'nextPage',      description: 'Next Page',          priority: 2 },
  SWIPE_RIGHT:  { name: 'Palm Move Right',emoji: '▶️', action: 'prevPage',      description: 'Previous Page',      priority: 2 },
  SWIPE_UP:     { name: 'Move Hand Up',   emoji: '⬆️', action: 'scrollUp',      description: 'Scroll Up',          priority: 2 },
  SWIPE_DOWN:   { name: 'Move Hand Down', emoji: '⬇️', action: 'scrollDown',    description: 'Scroll Down',        priority: 2 },
  THUMBS_UP:    { name: 'Thumbs Up',      emoji: '👍', action: 'bookmark',      description: 'Bookmark Document',  priority: 3 },
  PEACE:        { name: 'Peace Sign',     emoji: '✌️', action: 'summary',       description: 'Generate AI Summary', priority: 3 },
  FIST:         { name: 'Fist',           emoji: '✊', action: 'close',         description: 'Close Document',     priority: 3 },
  POINTING:     { name: 'Pointing',       emoji: '👉', action: 'select',        description: 'Next Document',      priority: 3 },
  OK_SIGN:      { name: 'OK Sign',        emoji: '👌', action: 'confirm',       description: 'Reset Zoom (100%)',  priority: 3 },
  OPEN_PALM:    { name: 'Open Palm',      emoji: '✋', action: 'showDocuments', description: 'Show Documents',     priority: 4 },
  ROCK_SIGN:    { name: 'Rock / YoYo',    emoji: '🤘', action: 'customRock',    description: 'Toggle Fullscreen',  priority: 4 },
  THREE:        { name: 'Three Fingers',  emoji: '🖖', action: 'customThree',   description: 'Open Gesture Guide', priority: 4 },
  FOUR:         { name: 'Four Fingers',   emoji: '🖐️', action: 'customFour',    description: 'Show Analytics',     priority: 4 },
};

const LANDMARKS = {
  WRIST: 0,
  THUMB:  { TIP: 4,  IP: 3,  MCP: 2,  CMC: 1  },
  INDEX:  { TIP: 8,  DIP: 7, PIP: 6,  MCP: 5  },
  MIDDLE: { TIP: 12, DIP: 11,PIP: 10, MCP: 9  },
  RING:   { TIP: 16, DIP: 15,PIP: 14, MCP: 13 },
  PINKY:  { TIP: 20, DIP: 19,PIP: 18, MCP: 17 },
};

const CONFIG = {
  GESTURE_COOLDOWN:          800,
  SAME_GESTURE_COOLDOWN:    1400,
  CONFIDENCE_THRESHOLD:      0.70,
  SWIPE_PIXEL_THRESHOLD:      30,
  SWIPE_HORIZONTAL_THRESHOLD: 36,
  SWIPE_VERTICAL_THRESHOLD:   30,
  SWIPE_MAX_TIME:            900,
  SWIPE_MIN_SAMPLES:           3,
  SWIPE_MIN_DIRECTION:         1.4,
  SWIPE_DIRECTION_CONSISTENCY: 0.65,
  SWIPE_VELOCITY_THRESHOLD:   0.14,
  HORIZONTAL_REBOUND_WINDOW: 1200,
  HORIZONTAL_REBOUND_THRESHOLD: 80,
  HORIZONTAL_REBOUND_VELOCITY: 0.26,
  HORIZONTAL_LOCKOUT_MS:      420,
  PINCH_CLOSE:    0.055,
  PINCH_DELTA:    0.012,
  STABILITY_FRAMES: 3,
};

// Motion gestures bypass the stability buffer (one-shot detections)
const MOTION_GESTURES = new Set([
  'SWIPE_LEFT', 'SWIPE_RIGHT', 'SWIPE_UP', 'SWIPE_DOWN',
  'PINCH_IN', 'PINCH_OUT',
]);

// ════════════════════════════════════════════════════════════════
// ✅ CHANGE 2: Scroll gestures fire faster for continuous feel
// ════════════════════════════════════════════════════════════════
const SCROLL_GESTURES = new Set(['SWIPE_UP', 'SWIPE_DOWN']);
const PAGE_SWIPE_GESTURES = new Set(['SWIPE_LEFT', 'SWIPE_RIGHT']);

const isCameraBusyError = (err) => {
  const name = String(err?.name || '').toLowerCase();
  const message = String(err?.message || '').toLowerCase();

  return (
    name === 'notreadableerror'
    || message.includes('device in use')
    || message.includes('could not start video source')
    || message.includes('track start error')
  );
};

const CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],[0,17],
];

// ════════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════════
const GestureRecognition = ({ enabled, onGestureDetected, onStatusChange }) => {
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const handsRef     = useRef(null);
  const animationRef = useRef(null);
  const streamRef    = useRef(null);

  const enabledRef = useRef(enabled);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  const lastGestureTimeRef = useRef(0);
  const lastGestureNameRef = useRef(null);
  const swipeHistoryRef    = useRef([]);
  const horizontalSwipeGuardRef = useRef({ lastType: null, lastAt: 0, lockUntil: 0 });
  const lastPinchDistRef   = useRef(null);
  const gestureHistoryRef  = useRef([]);
  const frameCountRef      = useRef(0);

  const [status,         setStatus]         = useState('disabled');
  const [error,          setError]          = useState(null);
  const [currentGesture, setCurrentGesture] = useState(null);
  const [debugMode,      setDebugMode]      = useState(false);
  const [minimized,      setMinimized]      = useState(false);
  const [handDetected,   setHandDetected]   = useState(false);
  const [debugInfo,      setDebugInfo]      = useState({
    handsDetected: 0, framesProcessed: 0, lastGesture: null,
    fingerStates: [], confidence: 0, swipeVelocity: 0, swipeDir: '—',
  });

  const updateStatus = useCallback((s) => {
    setStatus(s);
    onStatusChange?.(s);
  }, [onStatusChange]);

  // ════════════════════════════════════════════════════════════════
  // ✅ CHANGE 3: DEBOUNCED CONFIRM — scroll uses shorter cooldown
  // ════════════════════════════════════════════════════════════════
  const confirmGesture = useCallback((gestureInput) => {
    const gestureType = gestureInput?.type;
    const confidence = gestureInput?.confidence;

    if (!gestureType || confidence < CONFIG.CONFIDENCE_THRESHOLD) return;

    // Scroll gestures use shorter cooldown for continuous feel.
    // Page swipes are kept responsive but guarded by stronger swipe detection logic.
    const isScroll  = SCROLL_GESTURES.has(gestureType);
    const isPageSwipe = PAGE_SWIPE_GESTURES.has(gestureType);
    const gCooldown = isScroll ? 320 : isPageSwipe ? 520 : CONFIG.GESTURE_COOLDOWN;
    const sCooldown = isScroll ? 320 : isPageSwipe ? 780 : CONFIG.SAME_GESTURE_COOLDOWN;

    const now     = Date.now();
    const elapsed = now - lastGestureTimeRef.current;

    if (elapsed < gCooldown) return;
    if (gestureType === lastGestureNameRef.current && elapsed < sCooldown) return;

    const info = GESTURES[gestureType];
    if (!info) return;

    lastGestureTimeRef.current = now;
    lastGestureNameRef.current = gestureType;

    const gestureEvent = {
      gesture:   gestureType.toLowerCase(),
      action:    info.action,
      confidence,
      pointer:   gestureInput?.pointer || null,
      display:   info,
      timestamp: new Date().toISOString(),
    };

    setCurrentGesture(gestureEvent);
    setTimeout(() => setCurrentGesture(null), isScroll ? 600 : 2200);

    console.log(`🎯 FIRED: ${info.emoji} ${info.name} → ${info.action} (${Math.round(confidence * 100)}%)`);

    // Notify GestureGuide for practice mode highlighting
    window.dispatchEvent(new CustomEvent('gesture-detected', { detail: gestureEvent }));

    onGestureDetected?.(gestureEvent);
  }, [onGestureDetected]);

  const confirmGestureRef = useRef(confirmGesture);
  useEffect(() => { confirmGestureRef.current = confirmGesture; }, [confirmGesture]);

  // ════════════════════════════════════════════════════════════════
  // FINGER STATE DETECTOR
  // ════════════════════════════════════════════════════════════════
  const getFingerStates = useCallback((lm) => {
    const isRight = lm[LANDMARKS.THUMB.TIP].x < lm[LANDMARKS.PINKY.MCP].x;
    const thumb = isRight
      ? (lm[LANDMARKS.THUMB.TIP].x < lm[LANDMARKS.THUMB.MCP].x ? 1 : 0)
      : (lm[LANDMARKS.THUMB.TIP].x > lm[LANDMARKS.THUMB.MCP].x ? 1 : 0);

    const pairs = [
      [LANDMARKS.INDEX.TIP,  LANDMARKS.INDEX.PIP],
      [LANDMARKS.MIDDLE.TIP, LANDMARKS.MIDDLE.PIP],
      [LANDMARKS.RING.TIP,   LANDMARKS.RING.PIP],
      [LANDMARKS.PINKY.TIP,  LANDMARKS.PINKY.PIP],
    ];
    const others = pairs.map(([tip, pip]) => lm[tip].y < lm[pip].y - 0.02 ? 1 : 0);
    return [thumb, ...others];
  }, []);

  // ════════════════════════════════════════════════════════════════
  // PINCH DETECTION
  // ════════════════════════════════════════════════════════════════
  const detectPinch = useCallback((lm) => {
    const dist = Math.hypot(
      lm[LANDMARKS.THUMB.TIP].x - lm[LANDMARKS.INDEX.TIP].x,
      lm[LANDMARKS.THUMB.TIP].y - lm[LANDMARKS.INDEX.TIP].y,
    );
    const prev = lastPinchDistRef.current;
    lastPinchDistRef.current = dist;
    if (prev === null) return null;

    const delta = dist - prev;
    if (Math.abs(delta) < CONFIG.PINCH_DELTA) return null;
    if (delta < 0 && dist < CONFIG.PINCH_CLOSE * 1.4) return { type: 'PINCH_IN',  confidence: 0.88 };
    if (delta > 0 && prev < CONFIG.PINCH_CLOSE * 1.4) return { type: 'PINCH_OUT', confidence: 0.88 };
    return null;
  }, []);

  // ════════════════════════════════════════════════════════════════
  // SWIPE DETECTION (mirror-corrected)
  // ════════════════════════════════════════════════════════════════
  const detectSwipe = useCallback((lm, fingerCount) => {
    if (fingerCount < 2) {
      swipeHistoryRef.current = [];
      return null;
    }

    // Track palm center instead of fingertips so quick finger wiggles don't look like swipes.
    const rawX = (
      lm[LANDMARKS.WRIST].x +
      lm[LANDMARKS.INDEX.MCP].x +
      lm[LANDMARKS.PINKY.MCP].x
    ) / 3;
    const y = (
      lm[LANDMARKS.WRIST].y +
      lm[LANDMARKS.INDEX.MCP].y +
      lm[LANDMARKS.PINKY.MCP].y
    ) / 3;
    const now = Date.now();

    swipeHistoryRef.current.push({ x: rawX, y, t: now });
    swipeHistoryRef.current = swipeHistoryRef.current.filter(
      (p) => now - p.t < CONFIG.SWIPE_MAX_TIME
    );

    const history = swipeHistoryRef.current;
    if (history.length < CONFIG.SWIPE_MIN_SAMPLES) return null;

    const oldest = history[0];
    const newest = history[history.length - 1];
    const dt = newest.t - oldest.t;
    if (dt < 100) return null;

    const sampleCount = Math.max(1, history.length - 1);
    const avgIntervalMs = dt / sampleCount;
    const lowFpsMode = avgIntervalMs >= 75;
    const velocityThreshold = lowFpsMode
      ? CONFIG.SWIPE_VELOCITY_THRESHOLD * 0.75
      : CONFIG.SWIPE_VELOCITY_THRESHOLD;
    const consistencyThreshold = lowFpsMode
      ? CONFIG.SWIPE_DIRECTION_CONSISTENCY * 0.85
      : CONFIG.SWIPE_DIRECTION_CONSISTENCY;

    // Negate dx to compensate for CSS scaleX(-1) mirror.
    const dx = -(newest.x - oldest.x) * 640;
    const dy = (newest.y - oldest.y) * 480;
    const vx = Math.abs(dx) / dt;
    const vy = Math.abs(dy) / dt;

    const xSteps = [];
    const ySteps = [];
    for (let i = 1; i < history.length; i += 1) {
      xSteps.push(-(history[i].x - history[i - 1].x) * 640);
      ySteps.push((history[i].y - history[i - 1].y) * 480);
    }

    const dxSign = Math.sign(dx) || 1;
    const dySign = Math.sign(dy) || 1;
    const xConsistency = xSteps.length
      ? xSteps.filter((s) => Math.abs(s) < 1.5 || Math.sign(s) === dxSign).length / xSteps.length
      : 0;
    const yConsistency = ySteps.length
      ? ySteps.filter((s) => Math.abs(s) < 1.5 || Math.sign(s) === dySign).length / ySteps.length
      : 0;

    setDebugInfo((prev) => ({
      ...prev,
      swipeVelocity: Math.max(vx, vy).toFixed(3),
      swipeDir: dx > 12 ? '→' : dx < -12 ? '←' : dy > 12 ? '↓' : dy < -12 ? '↑' : '·',
    }));

    // Requested behavior:
    // - left movement -> next page only with open palm
    // - right movement -> previous page with open or closed palm
    const isPalmOpen = fingerCount >= 4;
    const isPalmClosed = fingerCount <= 1;
    const horizontalGuard = horizontalSwipeGuardRef.current;
    const inHorizontalLockout = now < horizontalGuard.lockUntil;

    if (
      !inHorizontalLockout &&
      vx > velocityThreshold &&
      vx > vy * CONFIG.SWIPE_MIN_DIRECTION &&
      Math.abs(dx) > CONFIG.SWIPE_HORIZONTAL_THRESHOLD &&
      xConsistency >= consistencyThreshold
    ) {
      const type = dx > 0 ? 'SWIPE_RIGHT' : 'SWIPE_LEFT';

      if (type === 'SWIPE_LEFT' && !isPalmOpen) {
        return null;
      }

      if (type === 'SWIPE_RIGHT' && !(isPalmOpen || isPalmClosed)) {
        return null;
      }

      const oppositeWithinWindow =
        horizontalGuard.lastType &&
        horizontalGuard.lastType !== type &&
        now - horizontalGuard.lastAt < CONFIG.HORIZONTAL_REBOUND_WINDOW;

      if (oppositeWithinWindow) {
        const reboundConsistency = Math.min(0.9, consistencyThreshold + 0.12);
        const reboundIsStrong =
          Math.abs(dx) > CONFIG.HORIZONTAL_REBOUND_THRESHOLD &&
          vx > CONFIG.HORIZONTAL_REBOUND_VELOCITY &&
          xConsistency >= reboundConsistency;

        if (!reboundIsStrong) {
          return null;
        }
      }

      horizontalSwipeGuardRef.current = {
        lastType: type,
        lastAt: now,
        lockUntil: now + CONFIG.HORIZONTAL_LOCKOUT_MS,
      };

      swipeHistoryRef.current = history.slice(-1);
      const conf = Math.min(0.95, 0.72 + vx * 0.6);
      console.log(
        `👆 Swipe: ${type} | dx=${dx.toFixed(1)}px | vx=${vx.toFixed(3)}px/ms | consistency=${xConsistency.toFixed(2)}`
      );
      return { type, confidence: conf };
    }

    if (
      vy > velocityThreshold &&
      vy > vx * CONFIG.SWIPE_MIN_DIRECTION &&
      Math.abs(dy) > CONFIG.SWIPE_VERTICAL_THRESHOLD &&
      yConsistency >= consistencyThreshold
    ) {
      swipeHistoryRef.current = history.slice(-1);
      const conf = Math.min(0.95, 0.72 + vy * 0.6);
      const type = dy > 0 ? 'SWIPE_DOWN' : 'SWIPE_UP';
      console.log(
        `👆 Swipe: ${type} | dy=${dy.toFixed(1)}px | vy=${vy.toFixed(3)}px/ms | consistency=${yConsistency.toFixed(2)}`
      );
      return { type, confidence: conf };
    }

    return null;
  }, []);

  // ════════════════════════════════════════════════════════════════
  // STATIC GESTURE CLASSIFIER
  // ════════════════════════════════════════════════════════════════
  const classifyStatic = useCallback((lm, fingers) => {
    const [thumb, index, middle, ring, pinky] = fingers;
    const total = fingers.reduce((a, b) => a + b, 0);

    if (total === 0) {
      const allClosed = [
        lm[LANDMARKS.INDEX.TIP].y  > lm[LANDMARKS.INDEX.MCP].y,
        lm[LANDMARKS.MIDDLE.TIP].y > lm[LANDMARKS.MIDDLE.MCP].y,
        lm[LANDMARKS.RING.TIP].y   > lm[LANDMARKS.RING.MCP].y,
        lm[LANDMARKS.PINKY.TIP].y  > lm[LANDMARKS.PINKY.MCP].y,
      ].every(Boolean);
      if (allClosed) return { type: 'FIST', confidence: 0.95 };
    }

    if (thumb && total === 1 && lm[LANDMARKS.THUMB.TIP].y < lm[LANDMARKS.THUMB.MCP].y)
      return { type: 'THUMBS_UP', confidence: 0.91 };

    if (index && total === 1) return { type: 'POINTING', confidence: 0.88 };

    // Peace sign: allow thumb to be either open or closed.
    if (index && middle && !ring && !pinky)
      return { type: 'PEACE', confidence: 0.90 };

    const thumbIndexDist = Math.hypot(
      lm[LANDMARKS.THUMB.TIP].x - lm[LANDMARKS.INDEX.TIP].x,
      lm[LANDMARKS.THUMB.TIP].y - lm[LANDMARKS.INDEX.TIP].y,
    );
    // OK sign: accept a slightly larger thumb-index circle and allow either middle or ring finger extended.
    if (thumbIndexDist < 0.085 && (middle || ring))
      return { type: 'OK_SIGN', confidence: 0.85 };

    if (index && pinky && !middle && !ring) return { type: 'ROCK_SIGN', confidence: 0.82 };
    if (index && middle && ring && !pinky && total === 3) return { type: 'THREE', confidence: 0.80 };
    if (!thumb && index && middle && ring && pinky && total === 4) return { type: 'FOUR', confidence: 0.80 };
    if (total >= 4 && thumb) return { type: 'OPEN_PALM', confidence: 0.78 };

    return null;
  }, []);

  // ════════════════════════════════════════════════════════════════
  // GESTURE PIPELINE
  // ════════════════════════════════════════════════════════════════
  const detectGesture = useCallback((lm) => {
    const fingers     = getFingerStates(lm);
    const fingerCount = fingers.reduce((a, b) => a + b, 0);
    // Camera feed is mirrored in UI, so invert x to match user-perceived pointer position.
    const pointer = {
      x: 1 - Math.min(Math.max(lm[LANDMARKS.INDEX.TIP].x, 0), 1),
      y: Math.min(Math.max(lm[LANDMARKS.INDEX.TIP].y, 0), 1),
    };
    setDebugInfo(prev => ({ ...prev, fingerStates: fingers }));

    const pinch = detectPinch(lm);
    if (pinch?.confidence >= CONFIG.CONFIDENCE_THRESHOLD) return { ...pinch, pointer };

    const swipe = detectSwipe(lm, fingerCount);
    if (swipe?.confidence >= CONFIG.CONFIDENCE_THRESHOLD) return { ...swipe, pointer };

    const staticG = classifyStatic(lm, fingers);
    if (staticG?.confidence >= CONFIG.CONFIDENCE_THRESHOLD) return { ...staticG, pointer };

    return null;
  }, [getFingerStates, detectPinch, detectSwipe, classifyStatic]);

  const detectGestureRef = useRef(detectGesture);
  useEffect(() => { detectGestureRef.current = detectGesture; }, [detectGesture]);

  // ════════════════════════════════════════════════════════════════
  // CANVAS OVERLAY (skeleton + swipe trail)
  // ════════════════════════════════════════════════════════════════
  const drawOverlay = useCallback((ctx, lm, W, H) => {
    const history = swipeHistoryRef.current;
    if (history.length >= 2) {
      for (let i = 1; i < history.length; i++) {
        const prev  = history[i - 1];
        const curr  = history[i];
        const alpha = i / history.length;
        ctx.save();
        ctx.strokeStyle = `rgba(56,189,248,${alpha * 0.9})`;
        ctx.lineWidth   = 6 * alpha;
        ctx.lineCap     = 'round';
        ctx.shadowColor = 'rgba(56,189,248,0.7)';
        ctx.shadowBlur  = 10 * alpha;
        ctx.beginPath();
        ctx.moveTo(prev.x * W, prev.y * H);
        ctx.lineTo(curr.x * W, curr.y * H);
        ctx.stroke();
        ctx.restore();
      }

      if (history.length >= 3) {
        const tail = history[Math.max(0, history.length - 4)];
        const head = history[history.length - 1];
        const angle = Math.atan2(
          (head.y - tail.y) * H,
          -(head.x - tail.x) * W,
        );
        ctx.save();
        ctx.translate(head.x * W, head.y * H);
        ctx.rotate(angle);
        ctx.fillStyle   = 'rgba(56,189,248,0.95)';
        ctx.shadowColor = 'rgba(56,189,248,0.8)';
        ctx.shadowBlur  = 12;
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(-7, -6);
        ctx.lineTo(-7,  6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.strokeStyle = 'rgba(34,197,94,0.85)';
    ctx.lineWidth   = 2;
    CONNECTIONS.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(lm[a].x * W, lm[a].y * H);
      ctx.lineTo(lm[b].x * W, lm[b].y * H);
      ctx.stroke();
    });

    lm.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, i === 0 ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle   = i === 0 ? '#F43F5E' : '#22C55E';
      ctx.shadowColor = i === 0 ? 'rgba(244,63,94,0.6)' : 'rgba(34,197,94,0.4)';
      ctx.shadowBlur  = 6;
      ctx.fill();
      ctx.shadowBlur  = 0;
    });
  }, []);

  // ════════════════════════════════════════════════════════════════
  // MEDIAPIPE RESULTS HANDLER
  // ════════════════════════════════════════════════════════════════
  const onMediaPipeResults = useCallback((results) => {
    frameCountRef.current++;
    const hasHand = (results.multiHandLandmarks?.length || 0) > 0;

    setHandDetected(hasHand);
    setDebugInfo(prev => ({
      ...prev,
      framesProcessed: frameCountRef.current,
      handsDetected:   results.multiHandLandmarks?.length || 0,
    }));

    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    const W = video.videoWidth  || 640;
    const H = video.videoHeight || 480;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width  = W;
      canvas.height = H;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    if (!hasHand) {
      swipeHistoryRef.current   = [];
      horizontalSwipeGuardRef.current = { lastType: null, lastAt: 0, lockUntil: 0 };
      lastPinchDistRef.current  = null;
      gestureHistoryRef.current = [];
      return;
    }

    const lm = results.multiHandLandmarks[0];
    drawOverlay(ctx, lm, W, H);

    const gesture = detectGestureRef.current(lm);

    if (gesture) {
      setDebugInfo(prev => ({
        ...prev,
        lastGesture: gesture.type,
        confidence:  gesture.confidence,
      }));

      if (MOTION_GESTURES.has(gesture.type)) {
        confirmGestureRef.current(gesture);
        gestureHistoryRef.current = [];
      } else {
        gestureHistoryRef.current.push(gesture.type);
        if (gestureHistoryRef.current.length > CONFIG.STABILITY_FRAMES) {
          gestureHistoryRef.current.shift();
        }
        const recent   = gestureHistoryRef.current;
        const isStable =
          recent.length === CONFIG.STABILITY_FRAMES &&
          recent.every(g => g === gesture.type);

        if (isStable) {
          confirmGestureRef.current(gesture);
          gestureHistoryRef.current = [];
        }
      }
    }
  }, [drawOverlay]);

  // ════════════════════════════════════════════════════════════════
  // FRAME LOOP
  // ════════════════════════════════════════════════════════════════
  const frameLoopRef = useRef(null);

  const runFrameLoop = useCallback(async () => {
    if (!enabledRef.current || !handsRef.current || !videoRef.current) return;
    try {
      if (videoRef.current.readyState >= 2) {
        await handsRef.current.send({ image: videoRef.current });
      }
    } catch (err) {
      console.warn('Frame error:', err.message);
    }
    if (enabledRef.current) {
      animationRef.current = requestAnimationFrame(() => frameLoopRef.current?.());
    }
  }, []);

  frameLoopRef.current = runFrameLoop;

  // ════════════════════════════════════════════════════════════════
  // STOP CAMERA
  // ════════════════════════════════════════════════════════════════
  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    updateStatus('disabled');
    setError(null);
    setHandDetected(false);
  }, [updateStatus]);

  // ════════════════════════════════════════════════════════════════
  // INIT
  // ════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!enabled) { stopCamera(); return; }

    let cancelled = false;

    const init = async () => {
      updateStatus('connecting');
      setError(null);

      try {
        try {
          const noop = () => {};
          if (window.Module) { window.Module.print = noop; window.Module.printErr = noop; }
          ['HandsModule', 'HandsSolutionModule'].forEach(k => {
            if (window[k]) { window[k].print = noop; window[k].printErr = noop; }
          });
        } catch (_) {}

        if (!window.Hands) {
          throw new Error('MediaPipe not loaded. Add CDN scripts to index.html');
        }

        const hands = new window.Hands({
          locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`,
        });

        hands.setOptions({
          maxNumHands:            1,
          modelComplexity:        0,
          minDetectionConfidence: 0.65,
          minTrackingConfidence:  0.55,
        });

        hands.onResults(onMediaPipeResults);
        handsRef.current = hands;

        streamRef.current?.getTracks().forEach(t => t.stop());

        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: false,
          });
        } catch (mediaErr) {
          if (isCameraBusyError(mediaErr)) {
            throw new Error(
              'Camera is already in use by another app. Close other camera apps and try again.'
            );
          }
          throw mediaErr;
        }

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        videoRef.current.srcObject = stream;

        await new Promise((resolve, reject) => {
          videoRef.current.onloadedmetadata = () => {
            if (canvasRef.current && videoRef.current) {
              canvasRef.current.width  = videoRef.current.videoWidth  || 640;
              canvasRef.current.height = videoRef.current.videoHeight || 480;
            }
            videoRef.current.play().then(resolve).catch(reject);
          };
          videoRef.current.onerror = reject;
        });

        if (cancelled) return;

        updateStatus('active');
        console.log('✅ GestureRecognition ready');
        setTimeout(() => { if (!cancelled) frameLoopRef.current?.(); }, 400);

      } catch (err) {
        if (!cancelled) {
          console.error('❌ Init failed:', err);
          setError(err.message);
          updateStatus('error');
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      stopCamera();
      if (handsRef.current) {
        try { handsRef.current.close(); } catch (_) {}
        handsRef.current = null;
      }
    };
  }, [enabled, onMediaPipeResults, stopCamera, updateStatus]);

  useEffect(() => () => {
    stopCamera();
    try { handsRef.current?.close(); } catch (_) {}
  }, [stopCamera]);

  if (!enabled) return null;

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  const statusLabel = {
    active: '👁 Tracking', connecting: '⏳ Starting…',
    error:  '❌ Error',    disabled:   '⚫ Off',
  }[status] ?? '⚫ Off';

  
  return (
    <div className="gr-root">
      <div className={`gr-camera-box ${minimized ? 'gr-minimized' : ''}`}>
        <div className="gr-camera-header">
          <div className="gr-header-left">
            <span className={`gr-dot gr-dot--${status}`} />
            <span className="gr-camera-title">{statusLabel}</span>
          </div>
          <div className="gr-header-btns">
            <button
              className={`gr-mini-btn ${debugMode ? 'gr-mini-btn--active' : ''}`}
              onClick={() => setDebugMode(d => !d)}
              title="Toggle debug"
            >🔍</button>
            <button
              className="gr-mini-btn"
              onClick={() => setMinimized(v => !v)}
              title={minimized ? 'Expand' : 'Minimize'}
            >{minimized ? '▲' : '▼'}</button>
          </div>
        </div>

        {!minimized && (
          <div className="gr-feed-wrap">
            <video ref={videoRef} className="gr-video" autoPlay muted playsInline />
            <canvas ref={canvasRef} className="gr-canvas" />

            {status === 'active' && !handDetected && (
              <div className="gr-no-hand">
                <span className="gr-no-hand-icon">✋</span>
                <span>Show your hand</span>
              </div>
            )}

            {handDetected && debugInfo.lastGesture && (
              <div className="gr-live-badge">
                {GESTURES[debugInfo.lastGesture]?.emoji}&nbsp;
                <span>{GESTURES[debugInfo.lastGesture]?.name}</span>
                <span className="gr-live-conf">
                  {Math.round((debugInfo.confidence ?? 0) * 100)}%
                </span>
              </div>
            )}
          </div>
        )}

        {minimized && status === 'active' && (
          <div className="gr-mini-hint">
            <span className={`gr-dot gr-dot--${status}`} style={{ width: 7, height: 7 }} />
            {handDetected ? '✋ Hand detected' : 'Watching…'}
          </div>
        )}
      </div>

      {currentGesture && (
        <div className="gr-toast" key={currentGesture.timestamp}>
          <span className="gr-toast-emoji">{currentGesture.display.emoji}</span>
          <div className="gr-toast-body">
            <span className="gr-toast-name">{currentGesture.display.name}</span>
            <span className="gr-toast-action">{currentGesture.display.description}</span>
          </div>
          <span className="gr-toast-conf">
            {Math.round(currentGesture.confidence * 100)}%
          </span>
        </div>
      )}

      {debugMode && (
        <div className="gr-debug">
          <div className="gr-debug-title">🔍 Debug</div>
          {[
            ['Status',     <strong key="s" className={`gr-ds gr-ds--${status}`}>{status}</strong>],
            ['Frames',     <strong key="f">{debugInfo.framesProcessed}</strong>],
            ['Hands',      <strong key="h">{debugInfo.handsDetected}</strong>],
            ['Gesture',    <strong key="g">{debugInfo.lastGesture || '—'}</strong>],
            ['Confidence', <strong key="c">{debugInfo.confidence ? `${Math.round(debugInfo.confidence * 100)}%` : '—'}</strong>],
            ['Swipe vel',  <strong key="v">{debugInfo.swipeVelocity ? `${debugInfo.swipeVelocity} px/ms` : '—'}</strong>],
            ['Swipe dir',  <strong key="d" style={{ fontSize: '1.1rem' }}>{debugInfo.swipeDir}</strong>],
            ['Fingers', (
              <div key="fi" className="gr-debug-fingers">
                {['T','I','M','R','P'].map((f, i) => (
                  <span key={f} className={`gr-finger ${debugInfo.fingerStates[i] ? 'gr-finger--up' : ''}`}>
                    {f}
                  </span>
                ))}
              </div>
            )],
          ].map(([label, val]) => (
            <div key={label} className="gr-debug-row">
              <span>{label}</span>{val}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="gr-error">
          <span>⚠️ {error}</span>
          <button onClick={() => { setError(null); updateStatus('disabled'); }}>✕</button>
        </div>
      )}
    </div>
  );
};

export default GestureRecognition;