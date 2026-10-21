import { Music2, Volume2, VolumeX } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import { FestiveAudioProvider, useFestiveAudio } from '../state/FestiveAudioContext';
import './festive-audio.css';

function SoundToggle() {
  const { enabled, playing, playbackState, supported, toggle } = useFestiveAudio();
  const active = enabled && playing;
  const label = active ? 'Tắt nhạc Tết và hiệu ứng âm thanh' : 'Phát nhạc Tết và hiệu ứng âm thanh';
  const text = active ? 'Nhạc Tết' : !enabled ? 'Bật nhạc Tết'
    : playbackState === 'loading' ? 'Đang tải nhạc…'
    : playbackState === 'error' ? 'Thử phát lại nhạc' : 'Chạm để nghe nhạc';
  return <button className={`festive-sound-toggle${active ? ' is-playing' : ''}`} type="button"
    data-sound-toggle aria-label={label} aria-pressed={active} disabled={!supported}
    title={!supported ? 'Âm thanh hiện chưa khả dụng' : playbackState === 'blocked'
      ? 'Trình duyệt yêu cầu một lần chạm để phát nhạc' : label} onClick={toggle}>
    {active ? <Volume2 size={18} aria-hidden="true"/> : <VolumeX size={18} aria-hidden="true"/>}
    <span>{text}</span>
    <Music2 size={14} className="festive-sound-note" aria-hidden="true"/>
  </button>;
}

export default function PlayerExperience() {
  return <FestiveAudioProvider><Outlet/><SoundToggle/></FestiveAudioProvider>;
}
