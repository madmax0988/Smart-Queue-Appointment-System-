import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute({ roles, children }) {
  const user = useAuthStore((s) => s.user);

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}
