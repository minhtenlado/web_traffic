import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Video, BarChart3, TrafficCone, Brain, Bell, ClipboardList, Settings, ChevronLeft, ChevronRight, Activity
} from 'lucide-react';
import useStore from '../../stores/trafficStore';
import useAuthStore from '../../stores/authStore';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Tổng quan' },
  { to: '/camera', icon: Video, label: 'Giám sát Camera' },
  { to: '/analytics', icon: BarChart3, label: 'Thống kê' },
  { to: '/signal', icon: TrafficCone, label: 'Điều khiển đèn' },
  { to: '/model', icon: Brain, label: 'Mô hình AI' },
  { to: '/alerts', icon: Bell, label: 'Cảnh báo' },
  { to: '/audit', icon: ClipboardList, label: 'Nhật ký', adminOnly: true },
  { to: '/admin', icon: Settings, label: 'Quản trị', adminOnly: true },
  { to: '/health', icon: Activity, label: 'Giám sát Hệ thống', adminOnly: true },
];

export default function Sidebar() {
  const open = useStore(s => s.sidebarOpen);
  const toggle = useStore(s => s.toggleSidebar);
  const alertCount = useStore(s => s.alerts.filter(a => !a.acknowledged).length);
  const isAdmin = useAuthStore(s => s.isAdmin());

  return (
    <aside className={`sidebar ${open ? '' : 'collapsed'}`}>
      <div className="sidebar-brand">
        {open && <span className="brand-text">GIAO THÔNG AI</span>}
        <button className="toggle-btn" onClick={toggle}>
          {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => {
          // Hide admin-only items for non-admins
          if (item.adminOnly && !isAdmin) return null;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              end={item.to === '/'}
            >
              <item.icon size={18} />
              {open && <span>{item.label}</span>}
              {item.to === '/alerts' && alertCount > 0 && (
                <span className="nav-badge">{alertCount}</span>
              )}
            </NavLink>
          );
        })}
      </nav>
      {open && (
        <div className="sidebar-footer">
          <span className="system-label">Ngã tư Hàng Xanh</span>
        </div>
      )}
    </aside>
  );
}
