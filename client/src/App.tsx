import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import { Protected } from './components/ui';
import { useAuth } from './auth';
import Start from './pages/Start';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import ExploreGigs from './pages/ExploreGigs';
import FindSkills from './pages/FindSkills';
import FreelancerProfile from './pages/FreelancerProfile';
import PostGig from './pages/PostGig';
import Recommendations from './pages/Recommendations';
import Bookings from './pages/Bookings';
import Chat from './pages/Chat';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import AIAssistant from './pages/AIAssistant';
import Dashboard from './pages/Dashboard';

const MEMBER = ['client', 'freelancer'];
// Floating shortcut to the SkillSpot AI assistant
function AIButton() {
  const { user } = useAuth(); const { pathname } = useLocation();
  if (!user?.onboarded || !MEMBER.includes(user.role) || ['/ai', '/chat'].some((p) => pathname.startsWith(p))) return null;
  return <Link to="/ai" className="fixed bottom-5 right-5 z-30 rounded-full bg-saffron px-5 py-3 font-semibold text-ink shadow-lg hover:brightness-95">Ask SkillSpot AI</Link>;
}

export default function App() {
  return (<>
    <Navbar />
    <Routes>
      <Route path="/" element={<Start />} />
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />
      <Route path="/gigs" element={<ExploreGigs />} />
      <Route path="/skills" element={<FindSkills />} />
      <Route path="/freelancer/:id" element={<FreelancerProfile />} />
      <Route path="/post" element={<Protected roles={['client']}><PostGig /></Protected>} />
      <Route path="/recommendations" element={<Protected roles={MEMBER}><Recommendations /></Protected>} />
      <Route path="/bookings" element={<Protected roles={MEMBER}><Bookings /></Protected>} />
      <Route path="/chat/:id?" element={<Protected roles={MEMBER}><Chat /></Protected>} />
      <Route path="/notifications" element={<Protected roles={MEMBER}><Notifications /></Protected>} />
      <Route path="/settings" element={<Protected roles={MEMBER}><Settings /></Protected>} />
      <Route path="/ai" element={<Protected roles={MEMBER}><AIAssistant /></Protected>} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
    </Routes>
    <AIButton />
    <footer className="mt-16 border-t border-ink/10 py-6 text-center text-sm text-ink/60">SkillSpot AI: always keep payments inside the platform and never share your OTP or CNIC with anyone.</footer>
  </>);
}
