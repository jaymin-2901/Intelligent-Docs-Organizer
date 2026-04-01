import { useState, useEffect, useCallback } from 'react';

let toastFn = null;

export const toast = {
  success: (msg) => toastFn?.('success', msg),
  error:   (msg) => toastFn?.('error',   msg),
  info:    (msg) => toastFn?.('info',    msg),
  warn:    (msg) => toastFn?.('warn',    msg),
};

const icons = {
  success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️',
};

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((type, message) => {
    const id = Date.now();
    setToasts((p) => [...p, { id, type, message }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  useEffect(() => { toastFn = add; return () => { toastFn = null; }; }, [add]);

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          <span className="toast__icon">{icons[t.type]}</span>
          <span className="toast__msg">{t.message}</span>
          <button className="toast__close" onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
