import { useAuth } from '../auth';
import ClientDashboard from './ClientDashboard';
import FreelancerDashboard from './FreelancerDashboard';
// Each mode gets its own interface
export default function Dashboard() {
  const { user } = useAuth();
  return user?.role === 'freelancer' ? <FreelancerDashboard /> : <ClientDashboard />;
}
