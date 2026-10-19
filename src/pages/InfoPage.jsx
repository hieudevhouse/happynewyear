import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Users } from 'lucide-react';
import { usePlayer } from '../state/PlayerContext';

export default function InfoPage() {
  const { player, setName, loading, sessionError, retrySession } = usePlayer();
  const [name, updateName] = useState(player.name);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { updateName(player.name); }, [player.name]);
  if (loading) return <section className="entry-card player-api-status" role="status">Đang khôi phục lượt nhận lộc…</section>;
  if (sessionError) return <section className="entry-card player-api-status" role="alert"><p>{sessionError}</p>
    <button className="primary-btn" type="button" onClick={retrySession}>Kết nối lại</button>
  </section>;
  if (!player.code) return <Navigate to="/" replace/>;
  const submit = async event => {
    event.preventDefault();
    if (pending) return;
    if (!name.trim()) { setError('Vui lòng nhập tên của bạn nhé!'); return; }
    setError('');
    setPending(true);
    try {
      await setName(name);
      navigate('/lucky');
    } catch (failure) {
      setError(failure.status ? failure.message : 'Chưa lưu được tên. Vui lòng kiểm tra kết nối và thử lại.');
    } finally { setPending(false); }
  };

  return <section className="entry-card">
    <div className="step-circle">02</div>
    <p className="eyebrow">ĐIỀN TÊN NHẬN LỘC</p>
    <h1>Xin chào,<br/><em>người may mắn!</em></h1>
    <p className="lead">Điền tên để đến cây đào<br/>và nhận món quà đầu xuân của bạn.</p>
    <form onSubmit={submit} aria-busy={pending}>
      <div className="code-input name-input"><Users size={21}/>
        <input aria-label="Tên người nhận lộc" autoComplete="name" maxLength={60} value={name} disabled={pending}
          onChange={event => { updateName(event.target.value); setError(''); }} placeholder="Tên của bạn là..."/>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary-btn" type="submit" disabled={pending}>{pending ? 'Đang lưu tên…' : 'Đến cây đào'} <ArrowRight size={19}/></button>
    </form>
    <Link className="back-btn" to="/">← Đổi mã nhận lộc</Link>
  </section>;
}
