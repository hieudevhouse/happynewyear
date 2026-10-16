import { Outlet } from 'react-router-dom';
import AmbientBackground from './AmbientBackground';
import Logo from './Logo';

export default function PlayerLayout() {
  return <div className="app-bg">
    <AmbientBackground/>
    <header className="topbar"><Logo/></header>
    <main className="player-wrap"><Outlet/></main>
  </div>;
}
