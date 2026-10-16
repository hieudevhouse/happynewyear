import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function RewardDialog({ reward, onClose, autoReturn = false }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => { if (element.open) element.close(); };
  }, []);

  useEffect(() => {
    if (!autoReturn) return;
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [autoReturn, onClose]);

  return <dialog className="lucky-reward-dialog" ref={dialog} aria-labelledby="lucky-reward-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <button type="button" className="lucky-reward-close" aria-label="Đóng phần thưởng, trở về cây đào" onClick={onClose}><X size={20}/></button>
    <div className="lucky-reward-emblem" aria-hidden="true">{reward.prize.icon}</div>
    <p className="lucky-reward-kicker">LÌ XÌ DÀNH CHO BẠN</p>
    <h2 id="lucky-reward-title">{reward.prize.title}</h2>
    <p className="lucky-reward-message">{reward.prize.sub}</p>
    <span className="lucky-reward-source">Bao số {String(reward.number).padStart(2, '0')} · {reward.style.name}</span>
    <button type="button" className="lucky-reward-return" onClick={onClose}>Về cây đào</button>
  </dialog>;
}
