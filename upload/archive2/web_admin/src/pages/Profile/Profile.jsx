import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Settings, Camera, Shield, LogOut, CheckCircle, Bell, Key, Globe, MonitorSmartphone } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import './Profile.css';

export default function Profile() {
  const [activeTab, setActiveTab] = useState('profile');
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const navigate = useNavigate();

  const handleSaveProfile = (e) => {
    e.preventDefault();
    alert('Đã cập nhật hồ sơ thành công!');
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    alert('Đã lưu cài đặt bảo mật!');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <div className="premium-profile-page fade-in">
      <div className="profile-header-backdrop"></div>
      
      <div className="profile-header-title">
        <h2 className="glow-text">Cài đặt Tài khoản</h2>
        <p className="subtitle">Quản lý thông tin cá nhân, cài đặt bảo mật và thông báo hệ thống.</p>
      </div>

      <div className="premium-profile-container">
        
        {/* Modern Sidebar */}
        <nav className="premium-sidebar">
          <div className="sidebar-avatar-card premium-card">
            <div className="avatar-ring-container">
              <div className="avatar-pulse-ring"></div>
              <div className="premium-avatar">
                <span className="initials">{getInitials(user?.fullName)}</span>
                <button className="avatar-edit-btn" title="Thay đổi ảnh đại diện">
                  <Camera size={14} />
                </button>
              </div>
            </div>
            <div className="user-info">
              <h3 className="user-name">{user?.fullName}</h3>
              <div className="role-badge">
                <Shield size={12} className="role-icon" />
                <span>{user?.role === 'admin' ? 'Admin(quản trị viên)' : 'Vận hành viên'}</span>
              </div>
            </div>
          </div>

          <div className="sidebar-nav-card premium-card">
            <button 
              className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={18} />
              <span>Thông tin cá nhân</span>
              {activeTab === 'profile' && <div className="active-indicator" />}
            </button>
            <button 
              className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={18} />
              <span>Bảo mật & Cài đặt</span>
              {activeTab === 'settings' && <div className="active-indicator" />}
            </button>
            
            <div className="nav-divider"></div>
            
            <button 
              className="nav-item text-danger"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
            >
              <LogOut size={18} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </nav>

        {/* Content Area */}
        <main className="premium-content">
          {activeTab === 'profile' && (
            <div className="content-section slide-up">
              
              <div className="premium-card bento-card">
                <div className="card-header">

                  <div>
                    <h3>Thông tin cơ bản</h3>
                    <p>Cập nhật tên, vai trò và thông tin hồ sơ của bạn.</p>
                  </div>
                </div>
                <div className="card-body">
                  <form onSubmit={handleSaveProfile} className="modern-form">
                    <div className="form-grid">
                      <div className="input-group">
                        <label>Họ và tên</label>
                        <div className="input-wrapper">
                          <input type="text" defaultValue={user?.fullName} className="premium-input" />
                          <div className="input-focus-ring"></div>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>Vai trò hệ thống</label>
                        <div className="input-wrapper read-only">
                          <input type="text" defaultValue={user?.role === 'admin' ? 'Admin(quản trị viên)' : 'Vận hành viên'} readOnly className="premium-input" />
                          <Shield size={16} className="input-icon-right" />
                        </div>
                      </div>
                    </div>
                    <div className="form-actions-right">
                      <button type="submit" className="premium-btn primary-btn">
                        <CheckCircle size={16} /> Lưu thay đổi
                      </button>
                    </div>
                  </form>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'settings' && (
            <div className="content-section slide-up">
              
              {/* Password Card */}
              <div className="premium-card bento-card">
                <div className="card-header">

                  <div>
                    <h3>Đổi mật khẩu</h3>
                    <p>Đảm bảo tài khoản của bạn sử dụng mật khẩu dài, ngẫu nhiên để giữ an toàn.</p>
                  </div>
                </div>
                <div className="card-body">
                  <form onSubmit={handleSaveSettings} className="modern-form">
                    <div className="input-group full-width">
                      <label>Mật khẩu hiện tại</label>
                      <div className="input-wrapper">
                        <input type="password" placeholder="Nhập mật khẩu hiện tại" className="premium-input" />
                        <div className="input-focus-ring"></div>
                      </div>
                    </div>
                    <div className="form-grid">
                      <div className="input-group">
                        <label>Mật khẩu mới</label>
                        <div className="input-wrapper">
                          <input type="password" placeholder="Mật khẩu mới" className="premium-input" />
                          <div className="input-focus-ring"></div>
                        </div>
                      </div>
                      <div className="input-group">
                        <label>Xác nhận mật khẩu</label>
                        <div className="input-wrapper">
                          <input type="password" placeholder="Xác nhận mật khẩu mới" className="premium-input" />
                          <div className="input-focus-ring"></div>
                        </div>
                      </div>
                    </div>
                    <div className="form-actions-right">
                      <button type="submit" className="premium-btn primary-btn">
                        Cập nhật mật khẩu
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* 2FA & Security */}
              <div className="premium-card bento-card mt-6">
                <div className="card-header">

                  <div>
                    <h3>Xác thực hai yếu tố (2FA)</h3>
                    <p>Thêm một lớp bảo mật phụ cho tài khoản của bạn.</p>
                  </div>
                </div>
                <div className="card-body">
                  <div className="premium-toggle-row">
                    <div className="toggle-info">
                      <h4>Xác thực qua SMS</h4>
                      <p>Nhận mã OTP qua số điện thoại 0987***321.</p>
                    </div>
                    <label className="premium-switch">
                      <input type="checkbox" defaultChecked />
                      <span className="premium-slider"></span>
                    </label>
                  </div>
                  <div className="premium-toggle-row">
                    <div className="toggle-info">
                      <h4>Google Authenticator</h4>
                      <p>Sử dụng ứng dụng xác thực để tạo mã dùng một lần.</p>
                    </div>
                    <label className="premium-switch">
                      <input type="checkbox" />
                      <span className="premium-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              {/* System Preferences */}
              <div className="premium-card bento-card mt-6">
                <div className="card-header">

                  <div>
                    <h3>Cài đặt hệ thống</h3>
                    <p>Tùy chỉnh trải nghiệm trên trang tổng quan của bạn.</p>
                  </div>
                </div>
                <div className="card-body">
                  <div className="form-grid">
                    <div className="input-group">
                      <label>Ngôn ngữ</label>
                      <div className="input-wrapper select-wrapper">
                        <select defaultValue="vi" className="premium-input select">
                          <option value="vi">Tiếng Việt (Vietnam)</option>
                          <option value="en">English (US)</option>
                        </select>
                        <div className="input-focus-ring"></div>
                      </div>
                    </div>
                    <div className="input-group">
                      <label>Thông báo</label>
                      <div className="input-wrapper select-wrapper">
                        <select defaultValue="all" className="premium-input select">
                          <option value="all">Thông báo Đẩy & Email</option>
                          <option value="email">Chỉ Email</option>
                          <option value="none">Tắt tất cả</option>
                        </select>
                        <div className="input-focus-ring"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="premium-card bento-card danger-zone mt-6">
                <div className="card-header">

                  <div>
                    <h3 className="text-danger">Phiên đăng nhập đang hoạt động</h3>
                    <p>Quản lý các thiết bị hiện đang đăng nhập vào tài khoản của bạn.</p>
                  </div>
                </div>
                <div className="card-body flex-between">
                  <div className="session-info">
                    <p>Thiết bị hiện tại: <strong>Mac OS (Chrome)</strong> — TP. Hồ Chí Minh, VN</p>
                  </div>
                  <button type="button" className="premium-btn danger-btn" onClick={() => alert('Đã đăng xuất khỏi các thiết bị khác!')}>
                    Đăng xuất khỏi các thiết bị khác
                  </button>
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}
