import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../stores/authStore';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const isAdmin = useAuthStore(s => s.isAdmin());
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login but save the attempted url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    // If not admin, maybe redirect to a 403 page or dashboard
    return <Navigate to="/" replace />;
  }

  return children;
}
