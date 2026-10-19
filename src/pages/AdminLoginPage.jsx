import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import Logo from '../components/Logo';
import { useAdmin } from '../state/AdminContext';
import '../admin.css';

export default function AdminLoginPage() {
  const { admin, loading, login } = useAdmin();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError('');
    try { await login(username.trim(), password); navigate('/adminl', { replace: true }); }
    catch (cause) { setError(cause.message || 'Đăng nhập chưa thành công. Vui lòng thử lại.'); }
    finally { setPending(false); }
  }
  if (!loading && admin) return <Navigate to="/adminl" replace/>;
  return <main className="lm-login">
    <Link className="lma-back-link" to="/"><ArrowLeft size={17}/> Về trang nhận lộc</Link>
    <section className="lma-login-card" aria-labelledby="login-heading">
      <div className="lma-brand"><Logo/><span>LuckyMoney<small>NIỀM VUI ĐẦU XUÂN</small></span></div>
      <div className="lma-login-symbol"><ShieldCheck size={30}/></div>
      <p className="lma-eyebrow">KHÔNG GIAN QUẢN TRỊ</p>
      <h1 id="login-heading">Chào mừng trở lại</h1>
      <p className="lma-description">Đăng nhập để quản lý mã quay và những món quà đầu xuân.</p>
      {loading ? <div className="lma-loading" role="status"><span className="lma-spinner"/> Đang kiểm tra đăng nhập…</div> : <form onSubmit={submit}>
        <label className="lma-field">Tên đăng nhập<div className="lma-input-icon"><UserRound size={18}/><input name="username" autoComplete="username" autoCapitalize="none" spellCheck="false" value={username} onChange={e => setUsername(e.target.value)} maxLength={100} required disabled={pending} placeholder="Tên đăng nhập của bạn"/></div></label>
        <label className="lma-field">Mật khẩu<div className="lma-input-icon"><LockKeyhole size={18}/><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} maxLength={200} required disabled={pending} placeholder="Nhập mật khẩu"/><button type="button" className="lma-eye" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
        {error && <p className="lma-message lma-error" role="alert">{error}</p>}
        <button type="submit" className="lma-button lma-primary lma-login-submit" disabled={pending}>{pending ? <><span className="lma-spinner"/> Đang đăng nhập…</> : <>Đăng nhập <ArrowRight size={18}/></>}</button>
      </form>}
      <p className="lma-login-note"><LockKeyhole size={14}/> Khu vực dành cho quản trị viên</p>
    </section>
    <p className="lma-login-footer">Một mùa xuân, ngàn điều may mắn.</p>
  </main>;
}
