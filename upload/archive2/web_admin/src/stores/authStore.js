import { create } from 'zustand';

// Lấy thông tin user từ localStorage nếu đã đăng nhập trước đó
const getStoredUser = () => {
  try {
    const user = localStorage.getItem('auth_user');
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

const useAuthStore = create((set) => ({
  user: getStoredUser(), // null nếu chưa đăng nhập
  isAuthenticated: !!getStoredUser(),

  login: (username, password) => {
    return new Promise((resolve, reject) => {
      // Giả lập độ trễ API
      setTimeout(() => {
        if (username === 'admin' && password === 'admin') {
          const userData = {
            id: 'U01',
            username: 'admin',
            fullName: 'Nguyễn Thanh Nhàn',
            role: 'admin',
            email: 'nhan.nt@gtvt.gov.vn'
          };
          localStorage.setItem('auth_user', JSON.stringify(userData));
          set({ user: userData, isAuthenticated: true });
          resolve(userData);
        } else if (username === 'staff' && password === 'staff') {
          const userData = {
            id: 'U02',
            username: 'staff',
            fullName: 'Trần Văn Vận Hành',
            role: 'staff',
            email: 'staff.tv@gtvt.gov.vn'
          };
          localStorage.setItem('auth_user', JSON.stringify(userData));
          set({ user: userData, isAuthenticated: true });
          resolve(userData);
        } else {
          reject(new Error('Tài khoản hoặc mật khẩu không chính xác'));
        }
      }, 800);
    });
  },

  logout: () => {
    localStorage.removeItem('auth_user');
    set({ user: null, isAuthenticated: false });
  },

  // Helper check quyền
  isAdmin: () => {
    const { user } = useAuthStore.getState();
    return user?.role === 'admin';
  }
}));

export default useAuthStore;
