import { Navigate, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Registration from './pages/Registration';
import ParticipantPortal from './pages/ParticipantPortal';
import Admin from './pages/Admin';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/pendaftaran" element={<Registration />} />
      <Route path="/peserta/:token" element={<ParticipantPortal />} />
      <Route path="/admin/*" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
