import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import "./App.css";

import DocumentViewer from "./components/DocumentViewer";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import GestureRecognition from "./components/GestureRecognition";
import GestureGuide from "./components/GestureGuide";

// ... [ALL ORIGINAL ERRORBOUNDARY, CONSTANTS, HELPERS FROM PREVIOUS App.jsx] ...

// ════════════════════════════════════════════════════════════════
import DashboardContent from './DashboardContent.jsx';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
<Route path="/dashboard/*" element={
        <ProtectedRoute>
          <DashboardContent />
        </ProtectedRoute>
      } />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
