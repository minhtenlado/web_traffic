import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar/Sidebar';
import Header from '../components/Header/Header';
import useStore from '../stores/trafficStore';
import './AdminLayout.css';

export default function AdminLayout() {
  const open = useStore(s => s.sidebarOpen);
  return (
    <div className="admin-layout">
      <Sidebar />
      <div className={`main-area ${open ? '' : 'sidebar-collapsed'}`}>
        <Header />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
