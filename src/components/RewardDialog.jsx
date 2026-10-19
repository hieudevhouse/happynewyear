import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import RewardCelebration from './RewardCelebration';

export default function RewardDialog({ reward, onClose, fresh = false }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);

  return <dialog className={`lucky-reward-dialog${fresh ? ' is-fresh' : ''}`} ref={dialog} aria-labelledby="lucky-reward-title" aria-describedby="lucky-reward-message"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    {fresh && <RewardCelebration/>}
    <button type="button" className="lucky-reward-close" aria-label="Đóng phần thưởng, trở về cây đào" onClick={onClose}><X size={20}/></button>
    <div className="lucky-reward-content">
      <div className="lucky-reward-emblem" aria-hidden="true">{reward.prize.icon}</div>
      <p className="lucky-reward-kicker">LÌ XÌ DÀNH CHO BẠN</p>
      <h2 id="lucky-reward-title">{reward.prize.title}</h2>
      <p className="lucky-reward-message" id="lucky-reward-message">{reward.prize.sub}</p>
      <span className="lucky-reward-source">Bao số {String(reward.number).padStart(2, '0')} · {reward.style.name}</span>
      <p className="lucky-reward-saved"><span aria-hidden="true">✓</span> Quà đã được lưu · Mỗi mã một phần quà</p>
      <button type="button" className="lucky-reward-return" onClick={onClose}>Giữ lộc, về cây đào</button>
    </div>
  </dialog>;
}
