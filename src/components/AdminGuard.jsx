import { Navigate, Outlet } from 'react-router-dom';
import { useAdmin } from '../state/AdminContext';
import '../admin.css';

export default function AdminGuard() {
  const { admin, loading } = useAdmin();
  if (loading) return <div className="lm-login"><div className="lma-loading" role="status"><span className="lma-spinner"/> Đang kiểm tra đăng nhập…</div></div>;
  return admin ? <Outlet/> : <Navigate to="/loginl" replace/>;
}
