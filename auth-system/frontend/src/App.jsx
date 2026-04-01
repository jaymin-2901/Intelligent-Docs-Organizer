import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute   from './components/ProtectedRoute';
import Login            from './pages/Login';
import Signup           from './pages/Signup';
import Dashboard        from './pages/Dashboard';
import Profile          from './pages/Profile';
import ForgotPassword   from './pages/ForgotPassword';

export default function App() {
  return (
    <Routes>
      <Route path="/"                  element={<Navigate to="/dashboard" replace />} />
      <Route path="/login"             element={<Login />} />
      <Route path="/signup"            element={<Signup />} />
      <Route path="/forgot-password"   element={<ForgotPassword />} />
      <Route path="/dashboard"         element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/profile"           element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="*"                  element={<Navigate to="/login" replace />} />
    </Routes>
  );
}