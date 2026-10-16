import { Navigate, Route, Routes } from 'react-router-dom';
import PlayerLayout from './components/PlayerLayout';
import HomePage from './pages/HomePage';
import InfoPage from './pages/InfoPage';
import LuckyPage from './pages/LuckyPage';
import AdminPage from './pages/AdminPage';
import { PlayerProvider } from './state/PlayerContext';

export default function App() {
  return <PlayerProvider>
    <Routes>
      <Route element={<PlayerLayout/>}>
        <Route path="/" element={<HomePage/>}/>
        <Route path="/info" element={<InfoPage/>}/>
      </Route>
      <Route path="/lucky" element={<LuckyPage/>}/>
      <Route path="/admin/*" element={<AdminPage/>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  </PlayerProvider>;
}
