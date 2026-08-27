import { useState, useEffect } from 'react';
import { Bell, User, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../stores/trafficStore';
import useAuthStore from '../../stores/authStore';
import './Header.css';

export default function Header() {
  const [time, setTime] = useState(new Date());
  const alertCount = useStore(s => s.alerts.filter(a => !a.acknowledged).length);
  const theme = useStore(s => s.theme);
  const toggleTheme = useStore(s => s.toggleTheme);
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    // Ensure document theme is set initially based on store
    document.documentElement.dataset.theme = theme;
    
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, [theme]);

  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="header-title">Hệ thống Giám sát Giao thông Thông minh</h1>
      </div>
      <div className="header-right">
        <div className="header-clock">
          <span className="clock-date">{time.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
          <span className="clock-time">{time.toLocaleTimeString('vi-VN')}</span>
        </div>
        <div className="header-divider" />
        
        <div className="header-user-wrapper">
          <div className="header-user" onClick={() => navigate('/profile')}>
            <User size={16} />
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ lineHeight: '1', fontWeight: '500' }}>{user?.fullName || 'Người dùng'}</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1', marginTop: '2px' }}>
                {user?.role === 'admin' ? 'Admin (Quản trị viên)' : 'Vận hành viên'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
