import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Ticket } from 'lucide-react';
import goatMascot from '../assets/golden-goat-2027.png';
import { usePlayer } from '../state/PlayerContext';

export default function HomePage() {
  const { player, start, loading, sessionError, retrySession } = usePlayer();
  const [code, setCode] = useState(player.code);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { setCode(current => current || player.code); }, [player.code]);
  const submit = async event => {
    event.preventDefault();
    if (pending || loading || sessionError) return;
    const normalized = code.trim().toUpperCase();
    if (!normalized) { setError('Nhập mã để tiếp tục nhé!'); return; }
    setError('');
    setPending(true);
    try {
      const current = await start(normalized);
      navigate(current.name ? '/lucky' : '/info');
    } catch (failure) {
      setError(failure.status ? failure.message : 'Không kết nối được máy chủ. Vui lòng thử lại.');
    } finally { setPending(false); }
  };

  return <section className="entry-card">
    <div className="hero-mascot"><div className="mascot-halo"/>
      <img src={goatMascot} alt="Dê vàng may mắn mùa xuân 2027"/>
    </div>
    <p className="eyebrow">MỞ LÌ XÌ ĐẦU NĂM</p>
    <h1>Chạm tay vào<br/><em>vận may</em> của bạn</h1>
    {loading && <p className="player-api-status" role="status">Đang khôi phục lượt nhận lộc…</p>}
    {sessionError && <div className="player-api-status" role="alert"><p>{sessionError}</p>
      <button className="back-btn" type="button" onClick={retrySession}>Kết nối lại</button>
    </div>}
    <form onSubmit={submit} aria-busy={pending}>
      <div className="code-input">
        <Ticket size={21}/>
        <input aria-label="Mã nhận lộc" value={code} onChange={event => { setCode(event.target.value); setError(''); }}
          maxLength={40} disabled={loading || Boolean(sessionError) || pending}
          autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="Nhập mã của bạn"/>
        <span>#{code.length}/40</span>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary-btn" type="submit" disabled={loading || Boolean(sessionError) || pending}>
        {pending ? 'Đang kiểm tra mã…' : 'Mở lộc ngay'} <ArrowRight size={19}/>
      </button>
    </form>
    <p className="hint">Mỗi mã dành cho một phần quà đầu xuân.</p>
  </section>;
}
