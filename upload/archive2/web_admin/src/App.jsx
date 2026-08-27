import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import AdminLayout from './layouts/AdminLayout';
import Dashboard from './pages/Dashboard/Dashboard';
import LiveMonitoring from './pages/LiveMonitoring/LiveMonitoring';
import Analytics from './pages/Analytics/Analytics';
import SignalControl from './pages/SignalControl/SignalControl';
import ModelManagement from './pages/ModelManagement/ModelManagement';
import Alerts from './pages/Alerts/Alerts';
import AuditLog from './pages/AuditLog/AuditLog';
import Admin from './pages/Admin/Admin';
import Profile from './pages/Profile/Profile';
import SystemHealth from './pages/SystemHealth/SystemHealth';
import Login from './pages/Login/Login';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import useStore from './stores/trafficStore';
import useAuthStore from './stores/authStore';

export default function App() {
  const tick = useStore(s => s.tick);
  const initFirebase = useStore(s => s.initFirebase);
  const updateHealthMetrics = useStore(s => s.updateHealthMetrics);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  useEffect(() => {
    let tickInterval;
    if (isAuthenticated) {
      // Start tick interval for traffic light countdowns
      tickInterval = setInterval(() => {
        tick();
      }, 1000);
      
      // Initialize Firebase sync
      initFirebase();
    }

    return () => {
      if (tickInterval) clearInterval(tickInterval);
    };
  }, [tick, initFirebase, isAuthenticated]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="camera" element={<LiveMonitoring />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="signal" element={<SignalControl />} />
          <Route path="model" element={<ModelManagement />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="profile" element={<Profile />} />
          
          {/* Admin only routes */}
          <Route path="audit" element={
            <ProtectedRoute requireAdmin={true}><AuditLog /></ProtectedRoute>
          } />
          <Route path="admin" element={
            <ProtectedRoute requireAdmin={true}><Admin /></ProtectedRoute>
          } />
          <Route path="health" element={
            <ProtectedRoute requireAdmin={true}><SystemHealth /></ProtectedRoute>
          } />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
