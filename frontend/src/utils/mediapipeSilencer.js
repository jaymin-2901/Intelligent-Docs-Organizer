/**
 * mediapipeSilencer.js
 *
 * Silences MediaPipe's internal WASM verbose logging.
 *
 * WHY: Google's MediaPipe is compiled from C++ → WebAssembly via Emscripten.
 * Emscripten bridges the C++ stderr stream to console.warn by default.
 * This means every internal MediaPipe log (GL context init, model loading,
 * SIMD info, etc.) appears in the browser console as warnings.
 *
 * These are NOT bugs — they are normal operational logs.
 * This utility intercepts console.warn/error and filters them out.
 */

// Patterns that identify MediaPipe internal WASM logs
const MP_PATTERNS = [
  /[WI]\d{4}\s+\d{2}:\d{2}:\d{2}/,    // W0000 / I0000 Google log timestamps
  /gl_context/i,                         // OpenGL context messages
  /OpenGL error checking/i,              // GL optimization notices
  /WebGL.*context/i,                     // WebGL init messages
  /hands_solution_simd/i,               // MediaPipe SIMD binary logs
  /hands\.js/,                           // Internal hands.js pipeline logs
  /put_char|doWritev|_fd_write/,        // Emscripten file descriptor writes
];

const isMediaPipeNoise = (...args) =>
  args.some(arg => MP_PATTERNS.some(pattern => pattern.test(String(arg))));

// Keep references to originals so we can restore them
let _origWarn  = null;
let _origError = null;
let _active    = false;

/**
 * Call once (e.g. in main.jsx) to silence MediaPipe WASM logs globally.
 * Safe to call multiple times — won't double-patch.
 */
export const silenceMediaPipe = () => {
  if (_active) return;
  _active = true;

  _origWarn  = console.warn.bind(console);
  _origError = console.error.bind(console);

  console.warn = (...args) => {
    if (!isMediaPipeNoise(...args)) _origWarn(...args);
  };

  console.error = (...args) => {
    if (!isMediaPipeNoise(...args)) _origError(...args);
  };

  // Also silence the direct Emscripten print/printErr overrides
  // that some MediaPipe versions use
  if (typeof window !== 'undefined') {
    window.__mediapipeSilenced = true;
  }
};

/**
 * Restore original console methods.
 * Call this only if you need to fully unload MediaPipe.
 */
export const restoreConsole = () => {
  if (!_active) return;
  _active = false;
  if (_origWarn)  console.warn  = _origWarn;
  if (_origError) console.error = _origError;
};

/**
 * Utility: check if silencer is currently active
 */
export const isSilenced = () => _active;