import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastContainer } from './components/Toast.jsx';
import App from './App.jsx';
import './index.css';

// Silence MediaPipe WASM logs (optional — remove if file doesn't exist)
try {
  const { silenceMediaPipe } = await import('./utils/mediapipeSilencer.js');
  silenceMediaPipe();
} catch (_) {}

// ✅ FIX: Prevent double createRoot during Vite HMR
const container = document.getElementById('root');

if (!container._reactRoot) {
  container._reactRoot = ReactDOM.createRoot(container);
}

container._reactRoot.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <ToastContainer />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
