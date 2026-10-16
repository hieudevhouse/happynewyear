import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Ticket } from 'lucide-react';
import goatMascot from '../assets/golden-goat-2027.png';
import { usePlayer } from '../state/PlayerContext';

export default function HomePage() {
  const { player, start } = usePlayer();
  const [code, setCode] = useState(player.code);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const submit = event => {
    event.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) { setError('Nhập mã để tiếp tục nhé!'); return; }
    if (!normalized.startsWith('LM-')) { setError('Mã chưa đúng. Mã mẫu bắt đầu bằng LM-'); return; }
    start(normalized);
    navigate('/info');
  };

  return <section className="entry-card">
    <div className="hero-mascot"><div className="mascot-halo"/>
      <img src={goatMascot} alt="Dê vàng may mắn mùa xuân 2027"/>
    </div>
    <p className="eyebrow">MỞ LÌ XÌ ĐẦU NĂM</p>
    <h1>Chạm tay vào<br/><em>vận may</em> của bạn</h1>
    <form onSubmit={submit}>
      <div className="code-input">
        <Ticket size={21}/>
        <input aria-label="Mã nhận lộc" value={code} onChange={event => setCode(event.target.value)}
          autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="Nhập mã của bạn"/>
        <span>#{code.length}/12</span>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary-btn" type="submit">Mở lộc ngay <ArrowRight size={19}/></button>
    </form>
  </section>;
}
