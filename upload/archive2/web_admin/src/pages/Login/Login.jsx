import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import useAuthStore from '../../stores/authStore';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore(s => s.login);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ tài khoản và mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      navigate('/'); // Thành công thì vào trang chủ
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-bg-layer"></div>
      <div className="login-left">
        <div className="login-left-content fade-in-up">
          <h1>Hệ thống Giám sát<br/><strong>Giao thông Thông minh</strong></h1>
          <p className="login-subtitle">Nền tảng quản lý lưu lượng, điều phối tín hiệu và phân tích dữ liệu ứng dụng Trí tuệ Nhân tạo (AI) dành cho Thành phố Thông minh.</p>
          <div className="login-features">
            <div className="feature-item">Giám sát Camera 24/7 với độ trễ siêu thấp</div>
            <div className="feature-item">Phân tích Lưu lượng Thời gian thực bằng AI</div>
            <div className="feature-item">Tự động Điều hướng và Cảnh báo Ùn tắc</div>
          </div>
        </div>
        <div className="login-overlay"></div>
      </div>
      
      <div className="login-right">
        <div className="login-form-wrapper">
          <div className="login-logo">
            <span>GIAO THÔNG AI</span>
          </div>
          
          <div className="login-header">
            <h2>Đăng nhập hệ thống</h2>
          </div>

          {error && (
            <div className="login-error fade-in">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input 
                  type="text" 
                  placeholder="Nhập tên tài khoản" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  placeholder="Nhập mật khẩu" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="login-footer">
            <p className="demo-hint">
              <strong>Tài khoản Demo:</strong><br/>
              Quản trị viên: <code>admin / admin</code><br/>
              Vận hành viên: <code>staff / staff</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
