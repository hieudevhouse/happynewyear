import { Navigate, Route, Routes } from 'react-router-dom';
import PlayerLayout from './components/PlayerLayout';
import HomePage from './pages/HomePage';
import InfoPage from './pages/InfoPage';
import LuckyPage from './pages/LuckyPage';
import AdminPage from './pages/AdminPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminGuard from './components/AdminGuard';
import { AdminProvider } from './state/AdminContext';
import { PlayerProvider } from './state/PlayerContext';
import './api-status.css';

export default function App() {
  return <AdminProvider><PlayerProvider>
    <Routes>
      <Route element={<PlayerLayout/>}>
        <Route path="/" element={<HomePage/>}/>
        <Route path="/info" element={<InfoPage/>}/>
      </Route>
      <Route path="/lucky" element={<LuckyPage/>}/>
      <Route path="/loginl" element={<AdminLoginPage/>}/>
      <Route element={<AdminGuard/>}>
        <Route path="/adminl/*" element={<AdminPage/>}/>
      </Route>
      <Route path="/admin/*" element={<Navigate to="/adminl" replace/>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  </PlayerProvider></AdminProvider>;
}
