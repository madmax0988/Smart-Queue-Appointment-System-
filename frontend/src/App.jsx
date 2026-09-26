import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import { connectSocket } from './store/socketStore';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import CustomerDashboard from './pages/CustomerDashboard';
import Booking from './pages/Booking';
import QueueTracking from './pages/QueueTracking';
import StaffDashboard from './pages/StaffDashboard';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (accessToken) connectSocket(accessToken);
  }, [accessToken]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={<ProtectedRoute roles={['CUSTOMER']}><CustomerDashboard /></ProtectedRoute>}
        />
        <Route
          path="/book"
          element={<ProtectedRoute roles={['CUSTOMER']}><Booking /></ProtectedRoute>}
        />
        <Route
          path="/queue/:appointmentId"
          element={<ProtectedRoute roles={['CUSTOMER']}><QueueTracking /></ProtectedRoute>}
        />
        <Route
          path="/staff"
          element={<ProtectedRoute roles={['STAFF', 'ADMIN']}><StaffDashboard /></ProtectedRoute>}
        />
        <Route
          path="/admin"
          element={<ProtectedRoute roles={['ADMIN']}><AdminDashboard /></ProtectedRoute>}
        />
      </Routes>
    </div>
  );
}
