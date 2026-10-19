import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Gift, LayoutDashboard, LogOut, Plus, RefreshCw, Search, Settings2, ShieldCheck, Ticket, Trash2, Users, X } from 'lucide-react';
import Logo from '../components/Logo';
import { useAdmin } from '../state/AdminContext';
import { api } from '../lib/api';
import '../admin.css';

const NAV = [
  { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'codes', label: 'Mã quay', icon: Ticket },
  { id: 'winners', label: 'Người nhận lộc', icon: Users },
  { id: 'prizes', label: 'Phần quà', icon: Gift }
];
const STATUS = { available: 'Chưa sử dụng', active: 'Đang chọn quà', used: 'Đã nhận quà', disabled: 'Đã khóa' };
const number = value => new Intl.NumberFormat('vi-VN').format(Number(value) || 0);
function dateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function useResource(path) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    api(path, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message || 'Không thể tải dữ liệu.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, version]);
  return { data, loading, error, refresh: () => setVersion(value => value + 1) };
}

function ResourceState({ loading, error, refresh, children }) {
  if (loading) return <div className="lma-loading" role="status"><span className="lma-spinner"/> Đang tải dữ liệu…</div>;
  if (error) return <div className="lma-load-error" role="alert"><p>{error}</p><button className="lma-button lma-secondary" onClick={refresh}><RefreshCw size={16}/> Thử lại</button></div>;
  return children;
}

function Empty({ icon: Icon = Gift, title = 'Chưa có dữ liệu', children }) {
  return <div className="lma-empty"><Icon size={30}/><h3>{title}</h3>{children && <p>{children}</p>}</div>;
}

function Pagination({ data, page, onChange }) {
  if (!data?.total) return null;
  return <div className="lma-pagination"><span>{number(data.total)} kết quả · Trang {data.page || page}/{Math.max(1, data.pages || 1)}</span><div><button className="lma-button lma-secondary" aria-label="Trang trước" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={18}/></button><button className="lma-button lma-secondary" aria-label="Trang sau" disabled={page >= (data.pages || 1)} onClick={() => onChange(page + 1)}><ChevronRight size={18}/></button></div></div>;
}

export default function AdminPage() {
  const { admin, logout } = useAdmin();
  const [tab, setTab] = useState('overview');
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const current = NAV.find(item => item.id === tab);
  function selectTab(next) { setTab(next); setLogoutError(''); }
  async function signOut() {
    setLogoutPending(true); setLogoutError('');
    try { await logout(); }
    catch (cause) { setLogoutError(cause.message || 'Chưa thể đăng xuất. Vui lòng thử lại.'); setLogoutPending(false); }
  }
  return <div className="lm-admin">
    <a href="#admin-content" className="lma-skip">Đến nội dung chính</a>
    <aside className="lma-sidebar">
      <Link className="lma-brand" to="/"><Logo/><span>LuckyMoney<small>QUẢN TRỊ MÙA XUÂN</small></span></Link>
      <p className="lma-side-label">KHÔNG GIAN QUẢN LÝ</p>
      <nav className="lma-nav" aria-label="Quản trị">{NAV.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={tab === id ? 'is-active' : ''} aria-current={tab === id ? 'page' : undefined} onClick={() => selectTab(id)}><Icon size={20}/><span>{label}</span></button>)}</nav>
      <div className="lma-side-footer"><div className="lma-side-flower" aria-hidden="true">✿</div><b>Trao lộc đầu xuân</b><p>Gửi niềm vui, đón may mắn.</p><Link to="/"><ArrowLeft size={15}/> Về trang nhận lộc</Link></div>
    </aside>
    <div className="lma-workspace">
      <header className="lma-header"><div><p className="lma-eyebrow">LUCKYMONEY / QUẢN TRỊ</p><h1>{current.label}</h1></div><div className="lma-account"><span className="lma-account-avatar"><ShieldCheck size={21}/></span><span className="lma-account-name"><b>{admin?.username}</b><small>Quản trị viên</small></span><button className="lma-button lma-secondary lma-logout" onClick={signOut} disabled={logoutPending} aria-label="Đăng xuất" title="Đăng xuất">{logoutPending ? <span className="lma-spinner"/> : <LogOut size={18}/>}<span>Đăng xuất</span></button></div></header>
      <main className="lma-content" id="admin-content" tabIndex={-1}>
        {logoutError && <p className="lma-message lma-error" role="alert">{logoutError}</p>}
        {tab === 'overview' && <Dashboard onNavigate={selectTab}/>}
        {tab === 'codes' && <Codes/>}
        {tab === 'winners' && <Winners/>}
        {tab === 'prizes' && <Prizes/>}
      </main>
      <footer className="lma-footer">LuckyMoney · Một mùa xuân, ngàn điều may mắn.</footer>
    </div>
  </div>;
}

function Dashboard({ onNavigate }) {
  const resource = useResource('/admin/dashboard');
  const stats = resource.data?.stats || {};
  const daily = resource.data?.daily || [];
  const recent = resource.data?.recent || [];
  const maxCount = Math.max(1, ...daily.map(day => Number(day.count) || 0));
  const cards = [
    { label: 'Tổng mã quay', value: stats.totalCodes, icon: Ticket, detail: `${number(stats.availableCodes)} mã sẵn sàng` },
    { label: 'Người tham gia', value: stats.totalPlayers, icon: Users, detail: `${number(stats.activeCodes)} mã đang nhận lộc` },
    { label: 'Phần quà đã trao', value: stats.totalRewards, icon: Gift, detail: `${number(stats.todayRewards)} phần quà hôm nay` },
    { label: 'Tỷ lệ nhận lộc', value: `${number(Math.round((Number(stats.redemptionRate) || 0) * 10) / 10)}%`, icon: ShieldCheck, detail: `${number(stats.usedCodes)} mã đã nhận đủ lộc` }
  ];
  return <ResourceState {...resource}>
    <div className="lma-section-heading"><div><h2>Mùa xuân trong những con số</h2><p>Theo dõi hành trình trao lộc của chương trình.</p></div><button className="lma-button lma-secondary" onClick={resource.refresh}><RefreshCw size={16}/> Làm mới</button></div>
    <section className="lma-stats" aria-label="Số liệu chương trình">{cards.map(({ label, value, icon: Icon, detail }) => <article className="lma-stat" key={label}><span className="lma-stat-icon"><Icon size={21}/></span><p>{label}</p><strong>{typeof value === 'string' ? value : number(value)}</strong><small>{detail}</small></article>)}</section>
    <div className="lma-dashboard-grid"><section className="lma-panel"><div className="lma-panel-heading"><div><h2>Lộc trao trong 7 ngày</h2><p>Số phần quà được mở mỗi ngày</p></div><span className="lma-tag">7 ngày gần nhất</span></div>{daily.length ? <div className="lma-bar-chart" role="img" aria-label={daily.map(day => `${day.date}: ${day.count} phần quà`).join(', ')}>{daily.map(day => <div className="lma-chart-column" key={day.date}><span className="lma-chart-count">{number(day.count)}</span><div className="lma-chart-track"><div className="lma-chart-bar" style={{ height: `${Math.max(day.count ? 3 : 0, (day.count / maxCount) * 100)}%` }}/></div><span className="lma-chart-label">{String(day.date).slice(5).split('-').reverse().join('/')}</span></div>)}</div> : <Empty title="Chưa có lượt nhận lộc">Những phần quà đầu tiên sẽ xuất hiện tại đây.</Empty>}</section>
      <section className="lma-panel"><div className="lma-panel-heading"><div><h2>Vừa đón lộc xuân</h2><p>Những phần quà được mở gần nhất</p></div><button className="lma-text-button" onClick={() => onNavigate('winners')} aria-label="Xem tất cả người nhận lộc"><ArrowRight size={19}/></button></div>{recent.length ? <div className="lma-recent">{recent.slice(0, 5).map((item, index) => <article className="lma-recent-row" key={item.id || index}><span className="lma-reward-icon" aria-hidden="true">{item.prize?.icon || '🧧'}</span><div><b>{item.name}</b><p>{item.prize?.title || (typeof item.prize === 'string' ? item.prize : 'Phần quà may mắn')}</p><small>{dateTime(item.openedAt)}</small></div></article>)}</div> : <Empty title="Chờ những niềm vui đầu tiên">Danh sách sẽ cập nhật khi có người nhận quà.</Empty>}</section></div>
    <section className="lma-spring-banner"><div><span aria-hidden="true">✿</span><div><h2>Thêm một mã, thêm một niềm vui</h2><p>Chuẩn bị những tấm vé may mắn cho mọi người.</p></div></div><button className="lma-button lma-primary" onClick={() => onNavigate('codes')}>Quản lý mã quay <ArrowRight size={17}/></button></section>
  </ResourceState>;
}

function Codes() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [pending, setPending] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const resource = useResource(`/admin/codes?search=${encodeURIComponent(query)}&status=${encodeURIComponent(status)}&page=${page}&limit=20`);
  const items = resource.data?.items || [];
  async function create(event) {
    event.preventDefault(); setPending('create'); setError(''); setMessage('');
    try {
      const data = await api('/admin/codes', { method: 'POST', body: customCode.trim() ? { code: customCode.trim().toUpperCase() } : { quantity: Number(quantity) } });
      setMessage(`Đã tạo ${number(data.items?.length || 1)} mã quay.`); setCustomCode(''); setCreateOpen(false); setPage(1); resource.refresh();
    } catch (cause) { setError(cause.message || 'Không thể tạo mã quay.'); }
    finally { setPending(''); }
  }
  async function changeCode(item, method) {
    setPending(item.id); setError(''); setMessage('');
    try {
      const deleting = method === 'DELETE';
      await api(`/admin/codes/${item.id}`, { method, ...(deleting ? {} : { body: { status: item.status === 'disabled' ? 'available' : 'disabled' } }) });
      setConfirmDelete(null); setMessage(deleting ? `Đã xóa mã ${item.code}.` : `Đã ${item.status === 'disabled' ? 'mở khóa' : 'khóa'} mã ${item.code}.`);
      if (deleting && items.length === 1 && page > 1) setPage(page - 1); else resource.refresh();
    } catch (cause) { setError(cause.message || 'Không thể cập nhật mã quay.'); }
    finally { setPending(''); }
  }
  return <>
    <div className="lma-section-heading"><div><h2>Những tấm vé may mắn</h2><p>Tạo mã, theo dõi lượt sử dụng và quản lý quyền nhận lộc.</p></div><button className="lma-button lma-primary" onClick={() => { setCreateOpen(value => !value); setError(''); }} aria-expanded={createOpen} aria-controls="create-codes">{createOpen ? <X size={17}/> : <Plus size={17}/>} {createOpen ? 'Đóng' : 'Tạo mã quay'}</button></div>
    {createOpen && <section className="lma-panel lma-form-panel" id="create-codes"><h2>Tạo mã quay mới</h2><p>Nhập một mã riêng hoặc để trống để tạo mã tự động.</p><form onSubmit={create} className="lma-create-form"><label className="lma-field">Mã riêng (tùy chọn)<input value={customCode} onChange={e => setCustomCode(e.target.value)} maxLength={64} placeholder="Ví dụ: XUAN-MAY-MAN" autoCapitalize="characters" disabled={!!pending}/></label><label className="lma-field">Số mã tự động<input type="number" min="1" max="500" step="1" value={customCode.trim() ? '1' : quantity} onChange={e => setQuantity(e.target.value)} required disabled={!!pending || !!customCode.trim()}/></label><button className="lma-button lma-primary" type="submit" disabled={!!pending}>{pending === 'create' ? <span className="lma-spinner"/> : <Plus size={17}/>} Tạo mã</button></form></section>}
    {message && <p className="lma-message lma-success" role="status"><Check size={17}/>{message}</p>}{error && <p className="lma-message lma-error" role="alert">{error}</p>}
    <section className="lma-panel"><form className="lma-filters" onSubmit={e => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}><label className="lma-search"><Search size={18}/><span className="lma-sr-only">Tìm mã quay hoặc tên người nhận</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã hoặc tên người nhận…"/><button type="submit" className="lma-button lma-secondary">Tìm</button></label><label className="lma-filter-label"><span className="lma-sr-only">Trạng thái mã</span><select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>{Object.entries(STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></form>
      <ResourceState {...resource}>{items.length ? <div className="lma-code-list"><div className="lma-code-head" aria-hidden="true"><span>Mã quay</span><span>Trạng thái</span><span>Người nhận / lượt mở</span><span>Thời gian</span><span>Thao tác</span></div>{items.map(item => <article className="lma-code-row" key={item.id}><div className="lma-code-name"><Ticket size={17}/><b>{item.code}</b></div><div><span className={`lma-status lma-status-${item.status}`}>{STATUS[item.status] || item.status}</span></div><div className="lma-code-player"><b>{item.name || 'Chưa có người nhận'}</b><small>{number(item.openedCount)} bao lì xì đã mở</small></div><div className="lma-code-time"><small>Tạo: {dateTime(item.createdAt)}</small>{item.usedAt && <small>Nhận: {dateTime(item.usedAt)}</small>}</div><div className="lma-code-actions">{confirmDelete === item.id ? <div className="lma-delete-confirm"><span>Xóa mã này?</span><button className="lma-button lma-danger" disabled={!!pending} onClick={() => changeCode(item, 'DELETE')}>Xóa</button><button className="lma-button lma-secondary" onClick={() => setConfirmDelete(null)} disabled={!!pending}>Hủy</button></div> : <><button className="lma-button lma-secondary" disabled={!!pending} onClick={() => changeCode(item, 'PATCH')}>{pending === item.id ? <span className="lma-spinner"/> : null}{item.status === 'disabled' ? 'Mở khóa' : 'Khóa'}</button>{(item.canDelete ?? ((item.status === 'available' || item.status === 'disabled') && !item.name && !item.openedCount)) && <button className="lma-button lma-icon-button" disabled={!!pending} aria-label={`Xóa mã ${item.code}`} title="Xóa mã" onClick={() => setConfirmDelete(item.id)}><Trash2 size={17}/></button>}</>}</div></article>)}</div> : <Empty icon={Ticket} title={query || status ? 'Không tìm thấy mã phù hợp' : 'Chưa có mã quay'}>{query || status ? 'Thử thay đổi từ khóa hoặc trạng thái tìm kiếm.' : 'Tạo những tấm vé đầu tiên cho chương trình.'}</Empty>}<Pagination data={resource.data} page={page} onChange={setPage}/></ResourceState>
    </section>
  </>;
}

function Winners() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const resource = useResource(`/admin/winners?search=${encodeURIComponent(query)}&page=${page}&limit=20`);
  const items = resource.data?.items || [];
  return <><div className="lma-section-heading"><div><h2>Niềm vui được trao đi</h2><p>Tra cứu người nhận, mã quay và từng phần quà đã mở.</p></div><button className="lma-button lma-secondary" onClick={resource.refresh}><RefreshCw size={16}/> Làm mới</button></div><section className="lma-panel"><form className="lma-filters" onSubmit={e => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}><label className="lma-search"><Search size={18}/><span className="lma-sr-only">Tìm tên người nhận hoặc mã quay</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên người nhận hoặc mã quay…"/><button type="submit" className="lma-button lma-secondary">Tìm</button></label></form><ResourceState {...resource}>{items.length ? <div className="lma-winner-grid">{items.map((item, index) => <article className="lma-winner-card" key={item.id || index}><span className="lma-winner-icon" style={{ backgroundColor: /^#[0-9a-f]{3,8}$/i.test(item.prize?.color || '') ? item.prize.color : undefined }} aria-hidden="true">{item.prize?.icon || '🧧'}</span><div><h3>{item.name}</h3><b>{item.prize?.title || 'Phần quà may mắn'}</b><p>{item.prize?.sub}</p><span className="lma-winner-code"><Ticket size={13}/>{item.code} · Bao {Number(item.index) + 1}</span><time dateTime={item.openedAt}>{dateTime(item.openedAt)}</time></div></article>)}</div> : <Empty icon={Users} title={query ? 'Không tìm thấy người nhận' : 'Chưa có người nhận lộc'}>{query ? 'Thử tìm bằng tên hoặc mã quay khác.' : 'Mỗi phần quà được mở sẽ được lưu lại tại đây.'}</Empty>}<Pagination data={resource.data} page={page} onChange={setPage}/></ResourceState></section></>;
}

const NEW_PRIZE = { title: '', sub: '', icon: '🧧', color: '#ffc93c', weight: '1', active: true };

function Prizes() {
  const resource = useResource('/admin/prizes');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(NEW_PRIZE);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const editorRef = useRef(null);
  const items = resource.data?.items || [];
  const totalWeight = items.filter(item => item.active).reduce((total, item) => total + Number(item.weight || 0), 0);
  function edit(item) {
    setEditing(item?.id || 'new'); setForm(item ? { title: item.title, sub: item.sub, icon: item.icon, color: item.color, weight: String(item.weight), active: item.active } : { ...NEW_PRIZE }); setError(''); setMessage('');
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  async function submit(event) {
    event.preventDefault(); setPending(true); setError(''); setMessage('');
    try {
      await api(editing === 'new' ? '/admin/prizes' : `/admin/prizes/${editing}`, { method: editing === 'new' ? 'POST' : 'PATCH', body: { ...form, title: form.title.trim(), sub: form.sub.trim(), icon: form.icon.trim(), weight: Number(form.weight) } });
      setMessage(editing === 'new' ? 'Đã thêm phần quà mới.' : 'Đã lưu thông tin phần quà.'); setEditing(null); resource.refresh();
    } catch (cause) { setError(cause.message || 'Không thể lưu phần quà.'); }
    finally { setPending(false); }
  }
  function update(field, value) { setForm(current => ({ ...current, [field]: value })); }
  return <>
    <div className="lma-section-heading"><div><h2>Những món quà đầu xuân</h2><p>Quản lý nội dung và tỷ trọng xuất hiện của từng phần quà.</p></div><button className="lma-button lma-primary" onClick={() => edit(null)} disabled={pending}><Plus size={17}/> Thêm phần quà</button></div>
    {message && <p className="lma-message lma-success" role="status"><Check size={17}/>{message}</p>}
    {editing && <section className="lma-panel lma-form-panel" ref={editorRef}><div className="lma-panel-heading"><h2>{editing === 'new' ? 'Thêm phần quà' : 'Chỉnh sửa phần quà'}</h2><button className="lma-button lma-icon-button" aria-label="Đóng chỉnh sửa" onClick={() => setEditing(null)} disabled={pending}><X size={19}/></button></div><form className="lma-prize-form" onSubmit={submit}><label className="lma-field">Tên phần quà<input value={form.title} onChange={e => update('title', e.target.value)} required maxLength={100} disabled={pending}/></label><label className="lma-field">Lời chúc<input value={form.sub} onChange={e => update('sub', e.target.value)} maxLength={200} disabled={pending}/></label><label className="lma-field">Biểu tượng<input value={form.icon} onChange={e => update('icon', e.target.value)} required maxLength={16} disabled={pending}/></label><label className="lma-field">Màu sắc<div className="lma-color-input"><input type="color" value={form.color} onChange={e => update('color', e.target.value)} disabled={pending}/><span>{form.color}</span></div></label><label className="lma-field">Tỷ trọng<input type="number" min="1" max="10000" step="1" value={form.weight} onChange={e => update('weight', e.target.value)} required disabled={pending}/></label><label className="lma-checkbox"><input type="checkbox" checked={form.active} onChange={e => update('active', e.target.checked)} disabled={pending}/><span>Cho phép xuất hiện khi nhận lộc</span></label><p className="lma-form-hint">Xác suất được tính theo tỷ trọng của phần quà trong tổng tỷ trọng đang bật. Tắt phần quà để tạm ngưng xuất hiện.</p>{error && <p className="lma-message lma-error" role="alert">{error}</p>}<div className="lma-form-actions"><button className="lma-button lma-primary" type="submit" disabled={pending}>{pending ? <span className="lma-spinner"/> : <Check size={17}/>} Lưu phần quà</button><button className="lma-button lma-secondary" type="button" onClick={() => setEditing(null)} disabled={pending}>Hủy</button></div></form></section>}
    <ResourceState {...resource}>{items.length ? <div className="lma-prize-grid">{items.map(item => <article className="lma-prize-card" key={item.id}><div className="lma-prize-card-top"><span className="lma-prize-icon" style={{ backgroundColor: /^#[0-9a-f]{3,8}$/i.test(item.color || '') ? item.color : undefined }} aria-hidden="true">{item.icon}</span><span className={`lma-status ${item.active ? 'lma-status-available' : 'lma-status-disabled'}`}>{item.active ? 'Đang áp dụng' : 'Tạm ngưng'}</span></div><h3>{item.title}</h3><p>{item.sub}</p><div className="lma-prize-meta"><span>Tỷ trọng <b>{number(item.weight)}</b></span><span>Xác suất <b>{item.active && totalWeight ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(item.weight) / totalWeight * 100) : '0'}%</b></span></div><button className="lma-button lma-secondary" onClick={() => edit(item)} disabled={pending}><Settings2 size={16}/> Chỉnh sửa</button></article>)}</div> : <Empty icon={Gift} title="Chưa có phần quà">Thêm phần quà để bắt đầu trao lộc.</Empty>}</ResourceState>
  </>;
}
