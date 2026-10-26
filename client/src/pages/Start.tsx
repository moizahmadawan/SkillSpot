import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import PublicHome from './PublicHome';
// "/" shows the public landing page to visitors and sends logged-in users straight to their own workspace.
export default function Start() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8">Loading…</p>;
  if (user) return <Navigate to={user.onboarded ? '/dashboard' : '/onboarding'} replace />;
  return <PublicHome />;
}
