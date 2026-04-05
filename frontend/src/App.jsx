import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const DashboardContent = lazy(() => import('./DashboardContent.jsx'));

function RouteFallback() {
  return (
    <div className="page-loading" aria-live="polite" aria-busy="true">
      <div className="page-loading__spinner" />
      <p>Loading workspace...</p>
    </div>
  );
}

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-loading">
        <div className="page-loading__spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  const defaultRoute = user ? '/dashboard/doc-view' : '/login';

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard/*" element={
          <ProtectedRoute>
            <DashboardContent />
          </ProtectedRoute>
        } />
        <Route path="/" element={<Navigate to={defaultRoute} replace />} />
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
