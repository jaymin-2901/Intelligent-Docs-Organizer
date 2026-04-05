import React, { useState, useEffect, useCallback, useRef } from 'react';
import './GestureGuide.css';

const FINGER_LABELS = ['T', 'I', 'M', 'R', 'P'];

const GESTURE_GROUPS = [
  {
    id: 'pages',
    title: 'Page Navigation',
    subtitle: 'Horizontal hand movement with shape rules',
    icon: '📖',
    color: '#38BDF8',
    type: 'motion',
    gestures: [
      { id: 'swipe_left',  emoji: '◀️', name: 'Swipe Left',  action: 'Next Page',     fingers: [1,1,1,1,1], motion: 'left',  tip: 'Open palm (all 5 fingers), then move LEFT quickly to go to the next page' },
      { id: 'swipe_right', emoji: '▶️', name: 'Swipe Right', action: 'Previous Page', fingers: [1,1,1,1,1], motion: 'right', tip: 'Move RIGHT quickly with open palm or closed fist to go to the previous page' },
    ],
  },
  {
    id: 'scroll',
    title: 'Page Scrolling',
    subtitle: 'Vertical movement only scrolls current page content',
    icon: '📜',
    color: '#A78BFA',
    type: 'motion',
    gestures: [
      { id: 'swipe_up',   emoji: '⬆️', name: '2-Finger Up',   action: 'Scroll Up',   fingers: [0,1,1,0,0], motion: 'up',   tip: 'Extend 2 fingers, move hand UP — this only scrolls current page content' },
      { id: 'swipe_down', emoji: '⬇️', name: '2-Finger Down', action: 'Scroll Down', fingers: [0,1,1,0,0], motion: 'down', tip: 'Extend 2 fingers, move hand DOWN — this only scrolls current page content' },
    ],
  },
  {
    id: 'zoom',
    title: 'Zoom Control',
    subtitle: 'Move thumb + index finger together or apart',
    icon: '🔍',
    color: '#34D399',
    type: 'motion',
    gestures: [
      { id: 'pinch_in',  emoji: '🤏', name: 'Pinch Close', action: 'Zoom Out (−)', fingers: [1,1,0,0,0], motion: 'pinch-in',  tip: 'Bring thumb + index fingertips together slowly' },
      { id: 'pinch_out', emoji: '🔍', name: 'Pinch Open',  action: 'Zoom In (+)',  fingers: [1,1,0,0,0], motion: 'pinch-out', tip: 'Start touching, spread thumb + index apart' },
    ],
  },
  {
    id: 'actions',
    title: 'Document Actions',
    subtitle: 'Hold a static pose for ~0.5s — keep hand STILL',
    icon: '⚡',
    color: '#FB923C',
    type: 'static',
    gestures: [
      { id: 'thumbs_up', emoji: '👍', name: 'Thumbs Up', action: 'Bookmark',       fingers: [1,0,0,0,0], tip: 'ONLY thumb pointing UP — curl all other fingers tightly' },
      { id: 'peace',     emoji: '✌️', name: 'Peace Sign', action: 'Generate AI Summary', fingers: [0,1,1,0,0], tip: 'Index + middle extended, ring + pinky curled — hold STILL' },
      { id: 'fist',      emoji: '✊', name: 'Fist',       action: 'Close Document', fingers: [0,0,0,0,0], tip: 'ALL fingers tightly closed into fist — hold steady' },
      { id: 'pointing',  emoji: '☝️', name: 'Point',      action: 'Select Next Doc', fingers: [0,1,0,0,0], tip: 'ONLY index finger up — all others curled' },
      { id: 'ok_sign',   emoji: '👌', name: 'OK Sign',    action: 'Reset Zoom (100%)', fingers: [1,1,1,1,0], special: 'ok', tip: 'Touch thumb tip to index tip — extend middle + ring' },
    ],
  },
  {
    id: 'view',
    title: 'View & Navigation',
    subtitle: 'Hold static poses — hand must be STILL',
    icon: '🎛️',
    color: '#F472B6',
    type: 'static',
    gestures: [
      { id: 'open_palm', emoji: '✋', name: 'Open Palm',      action: 'Show Documents',  fingers: [1,1,1,1,1], tip: 'ALL 5 fingers spread wide open — hold completely still' },
      { id: 'rock_sign', emoji: '🤘', name: 'Rock / YoYo Sign', action: 'Toggle Fullscreen View', fingers: [0,1,0,0,1], tip: 'ONLY index + pinky up — middle + ring curled' },
      { id: 'three',     emoji: '3️⃣', name: 'Three Fingers', action: 'Open Gesture Guide', fingers: [0,1,1,1,0], tip: 'Index + middle + ring up — pinky curled, thumb optional' },
      { id: 'four',      emoji: '4️⃣', name: 'Four Fingers',  action: 'Show Analytics',   fingers: [0,1,1,1,1], tip: 'All 4 fingers up — THUMB must be tucked down' },
    ],
  },
];

// ════════════════════════════════════════════════════════════════
// HAND DIAGRAM
// ════════════════════════════════════════════════════════════════
const HandDiagram = ({ fingers, motion, special, isActive }) => {
  const motionArrows = { left: '←', right: '→', up: '↑', down: '↓' };

  return (
    <div className={`hd ${isActive ? 'hd-active' : ''} ${motion ? `hd-motion-${motion}` : ''}`}>
      <div className="hd-fingers">
        {fingers.map((up, i) => (
          <div key={i} className={`hd-f ${up ? 'hd-up' : 'hd-down'} hd-f-${i}`}>
            <div className="hd-tip-circle" />
            <div className="hd-shaft-bar" />
            <span className="hd-lbl">{FINGER_LABELS[i]}</span>
          </div>
        ))}
      </div>
      <div className="hd-palm-bar" />

      {motion && !motion.includes('pinch') && (
        <div className={`hd-arrow hd-arrow-${motion}`}>
          <span>{motionArrows[motion]}</span>
        </div>
      )}

      {motion === 'pinch-in' && (
        <div className="hd-pinch">
          <span className="hd-dot" />
          <span className="hd-pinch-arrows">› ‹</span>
          <span className="hd-dot" />
        </div>
      )}
      {motion === 'pinch-out' && (
        <div className="hd-pinch hd-pinch-open">
          <span className="hd-dot" />
          <span className="hd-pinch-arrows">‹ ›</span>
          <span className="hd-dot" />
        </div>
      )}

      {special === 'ok' && <div className="hd-special">thumb touches index</div>}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════
const GestureGuide = () => {
  const [activeGesture, setActiveGesture] = useState(null);
  const [practiceMode, setPracticeMode]   = useState(false);
  const [completed, setCompleted]         = useState(new Set());
  const [filterGroup, setFilterGroup]     = useState(null);
  const timeoutRef = useRef(null);

  const totalGestures = GESTURE_GROUPS.reduce((n, g) => n + g.gestures.length, 0);

  useEffect(() => {
    const onGesture = (e) => {
      const id = e.detail?.gesture;
      if (!id) return;
      setActiveGesture(id);
      if (practiceMode) setCompleted(prev => new Set([...prev, id]));
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setActiveGesture(null), 1800);
    };
    window.addEventListener('gesture-detected', onGesture);
    return () => { window.removeEventListener('gesture-detected', onGesture); clearTimeout(timeoutRef.current); };
  }, [practiceMode]);

  const resetProgress = useCallback(() => setCompleted(new Set()), []);
  const visibleGroups = filterGroup ? GESTURE_GROUPS.filter(g => g.id === filterGroup) : GESTURE_GROUPS;

  return (
    <div className="gesture-guide">
      {/* HEADER */}
      <div className="gg-header">
        <div className="gg-header-top">
          <div className="gg-header-icon-wrap"><span className="gg-header-icon">🖐️</span></div>
          <div className="gg-header-text">
            <h2>Gesture Control Guide</h2>
            <p>{totalGestures} gestures across {GESTURE_GROUPS.length} categories — master touchless control</p>
          </div>
          <button className={`gg-practice-toggle ${practiceMode ? 'active' : ''}`} onClick={() => setPracticeMode(p => !p)}>
            <span className="gg-practice-dot" />
            {practiceMode ? '🎯 Practice ON' : '🎮 Practice Mode'}
          </button>
        </div>

        {practiceMode && (
          <div className="gg-progress-wrap">
            <div className="gg-progress-track">
              <div className="gg-progress-fill" style={{ width: `${(completed.size / totalGestures) * 100}%` }} />
            </div>
            <div className="gg-progress-info">
              <span>{completed.size === totalGestures ? '🎉 All gestures mastered!' : `${completed.size} / ${totalGestures} completed`}</span>
              {completed.size > 0 && <button className="gg-reset-btn" onClick={resetProgress}>↻ Reset</button>}
            </div>
          </div>
        )}
      </div>

      {/* TIPS */}
      <div className="gg-tips-banner">
        <div className="gg-tip"><span className="gg-tip-icon">⚡</span><strong>Motion gestures</strong> fire instantly — just move quickly</div>
        <div className="gg-tip"><span className="gg-tip-icon">🤚</span><strong>Static gestures</strong> need ~0.5s hold — stay STILL</div>
        <div className="gg-tip"><span className="gg-tip-icon">🚫</span><strong>Motion lockout</strong> — moving hand won't trigger static gestures</div>
        <div className="gg-tip"><span className="gg-tip-icon">📏</span>Keep hand <strong>30–60 cm</strong> from camera in good lighting</div>
        <div className="gg-tip"><span className="gg-tip-icon">🎯</span><strong>Direction consistency</strong> — swipe in a straight line for best accuracy</div>
        <div className="gg-tip"><span className="gg-tip-icon">📐</span><strong>Hand scale</strong> — distances are normalized so any hand size works</div>
      </div>

      {/* FILTERS */}
      <div className="gg-filters">
        <button className={`gg-filter ${!filterGroup ? 'active' : ''}`} onClick={() => setFilterGroup(null)}>All ({totalGestures})</button>
        {GESTURE_GROUPS.map(g => (
          <button key={g.id} className={`gg-filter ${filterGroup === g.id ? 'active' : ''}`} style={{ '--fc': g.color }} onClick={() => setFilterGroup(p => p === g.id ? null : g.id)}>
            {g.icon} {g.title} ({g.gestures.length})
          </button>
        ))}
      </div>

      {/* GROUPS */}
      <div className="gg-groups">
        {visibleGroups.map(group => (
          <div key={group.id} className="gg-group" style={{ '--gc': group.color }}>
            <div className="gg-group-header">
              <span className="gg-group-icon">{group.icon}</span>
              <div className="gg-group-text">
                <h3>{group.title}</h3>
                <p>{group.subtitle}</p>
              </div>
              <span className={`gg-type-badge gg-type-${group.type}`}>
                {group.type === 'motion' ? '🌊 Motion' : '🤚 Static'}
              </span>
            </div>

            <div className="gg-cards">
              {group.gestures.map(gesture => {
                const isActive = activeGesture === gesture.id;
                const isDone = completed.has(gesture.id);

                return (
                  <div key={gesture.id} className={['gg-card', isActive && 'gg-card-active', isDone && 'gg-card-done'].filter(Boolean).join(' ')}>
                    {isActive && <div className="gg-card-pulse" />}
                    {isDone && <div className="gg-card-check">✓</div>}

                    <div className="gg-card-top">
                      <span className="gg-card-emoji">{gesture.emoji}</span>
                      <div className="gg-card-meta">
                        <h4>{gesture.name}</h4>
                        <span className="gg-card-action">{gesture.action}</span>
                      </div>
                    </div>

                    <HandDiagram fingers={gesture.fingers} motion={gesture.motion} special={gesture.special} isActive={isActive} />

                    <div className="gg-card-tip"><span>💡</span><span>{gesture.tip}</span></div>
                    {practiceMode && !isDone && <div className="gg-card-try">Try it!</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* CONFLICT AVOIDANCE */}
      <div className="gg-conflicts-section">
        <h3>⚠️ How Similar Gestures Are Distinguished</h3>
        <div className="gg-conflict-cards">
          <div className="gg-conflict">
            <div className="gg-conflict-pair">
              <span className="gg-conflict-left">✌️ Peace</span>
              <span className="gg-conflict-vs">vs</span>
              <span className="gg-conflict-right">🌊 Motion Gestures</span>
            </div>
            <p>Similar finger shapes can overlap. <strong>Key: motion lockout</strong></p>
            <div className="gg-conflict-solution">
              <span className="gg-sol-do">✅ Peace:</span> Hold hand completely STILL for 0.5s<br />
              <span className="gg-sol-do">✅ Swipe:</span> Quick deliberate movement — blocks static detection
            </div>
          </div>

          <div className="gg-conflict">
            <div className="gg-conflict-pair">
              <span className="gg-conflict-left">3️⃣ Three</span>
              <span className="gg-conflict-vs">vs</span>
              <span className="gg-conflict-right">4️⃣ Four</span>
            </div>
            <p><strong>Key: pinky position</strong></p>
            <div className="gg-conflict-solution">
              <span className="gg-sol-do">✅ Three:</span> Index + middle + ring up — pinky CURLED<br />
              <span className="gg-sol-do">✅ Four:</span> All 4 fingers up — THUMB tucked down
            </div>
          </div>

          <div className="gg-conflict">
            <div className="gg-conflict-pair">
              <span className="gg-conflict-left">4️⃣ Four</span>
              <span className="gg-conflict-vs">vs</span>
              <span className="gg-conflict-right">✋ Open Palm</span>
            </div>
            <p><strong>Key: thumb position</strong></p>
            <div className="gg-conflict-solution">
              <span className="gg-sol-do">✅ Four:</span> Thumb TUCKED into palm — 4 fingers only<br />
              <span className="gg-sol-do">✅ Open Palm:</span> ALL 5 fingers including thumb spread wide
            </div>
          </div>

          <div className="gg-conflict">
            <div className="gg-conflict-pair">
              <span className="gg-conflict-left">☝️ Point</span>
              <span className="gg-conflict-vs">vs</span>
              <span className="gg-conflict-right">👍 Thumbs Up</span>
            </div>
            <p><strong>Key: which finger is up</strong></p>
            <div className="gg-conflict-solution">
              <span className="gg-sol-do">✅ Point:</span> INDEX finger only — thumb curled<br />
              <span className="gg-sol-do">✅ Thumbs Up:</span> THUMB only pointing upward — all others curled
            </div>
          </div>
        </div>
      </div>

      {/* ACCURACY FEATURES */}
      <div className="gg-accuracy-section">
        <h3>🎯 Accuracy Features</h3>
        <div className="gg-accuracy-grid">
          {[
            ['📐 Hand Scale Normalization', 'Distances are measured relative to your palm size — works with any hand size at any distance'],
            ['🌊 Motion Lockout', 'When hand is moving fast, static gestures are blocked — prevents false triggers during swipes'],
            ['📊 Direction Consistency', 'Swipes check that most tracked points agree on direction — filters random jitter'],
            ['🔄 Smoothed Pinch', 'Pinch uses rolling average distance — eliminates noise from finger tremor'],
            ['🧮 Multi-Method Fingers', 'Each finger uses 3 detection methods combined: distance, tip-above-pip, and joint angle'],
            ['⏱️ Stability Buffer', 'Static gestures need 3 consecutive frames of the same detection before firing'],
          ].map(([title, desc]) => (
            <div key={title} className="gg-accuracy-card">
              <h4>{title}</h4>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* KEYBOARD */}
      <div className="gg-keyboard-section">
        <h3>⌨️ Keyboard Alternatives</h3>
        <div className="gg-keys">
          {[
            ['← →', 'Navigate pages'],
            ['+ −', 'Zoom in / out'],
            ['0', 'Reset zoom'],
            ['F', 'Fit page width'],
            ['Esc', 'Close document'],
            ['Ctrl+Scroll', 'Mouse zoom'],
          ].map(([key, desc]) => (
            <div key={key} className="gg-key"><kbd>{key}</kbd><span>{desc}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GestureGuide;