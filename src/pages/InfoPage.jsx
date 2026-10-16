import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Users } from 'lucide-react';
import { usePlayer } from '../state/PlayerContext';

export default function InfoPage() {
  const { player, setName } = usePlayer();
  const [name, updateName] = useState(player.name);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  if (!player.code) return <Navigate to="/" replace/>;
  const submit = event => {
    event.preventDefault();
    if (!name.trim()) { setError('Vui lòng nhập tên của bạn nhé!'); return; }
    setName(name);
    navigate('/lucky');
  };

  return <section className="entry-card">
    <div className="step-circle">02</div>
    <p className="eyebrow">ĐIỀN TÊN NHẬN LỘC</p>
    <h1>Xin chào,<br/><em>người may mắn!</em></h1>
    <p className="lead">Điền tên để đến cây đào<br/>và nhận món quà đầu xuân của bạn.</p>
    <form onSubmit={submit}>
      <div className="code-input name-input"><Users size={21}/>
        <input aria-label="Tên người nhận lộc" autoComplete="name" maxLength={60} value={name}
          onChange={event => updateName(event.target.value)} placeholder="Tên của bạn là..."/>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary-btn" type="submit">Đến cây đào <ArrowRight size={19}/></button>
    </form>
    <Link className="back-btn" to="/">← Đổi mã nhận lộc</Link>
  </section>;
}
