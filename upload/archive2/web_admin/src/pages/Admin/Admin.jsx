import { useState, useMemo } from 'react';
import { Users, Camera, Server, ExternalLink, Edit2, Trash2, Plus, TrafficCone, Eye } from 'lucide-react';
import { generateUsers } from '../../services/mockData';
import { CAMERAS, USER_ROLES } from '../../utils/constants';
import { formatDateTime } from '../../utils/formatters';
import './Admin.css';

export default function Admin() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState(() => generateUsers());
  const [cameras, setCameras] = useState(CAMERAS);
  const [modal, setModal] = useState(null); // { type: 'add_user' | 'edit_user' | 'add_cam', data: any }

  const handleSaveSettings = (e) => {
    e.preventDefault();
    alert('Đã lưu cài đặt hệ thống!');
  };

  const handleToggleApi = (name) => {
    alert(`Đã thay đổi trạng thái kết nối: ${name}`);
  };

  const handleDeleteUser = (id) => {
    if (confirm('Bạn có chắc muốn xóa người dùng này?')) {
      setUsers(users.filter(u => u.id !== id));
    }
  };

  const renderTabs = () => (
    <div className="admin-tabs">
      <button className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}><Users size={16} /> Người dùng</button>
      <button className={`tab-btn ${activeTab === 'cameras' ? 'active' : ''}`} onClick={() => setActiveTab('cameras')}><Camera size={16} /> Camera</button>
      <button className={`tab-btn ${activeTab === 'signals' ? 'active' : ''}`} onClick={() => setActiveTab('signals')}><TrafficCone size={16} /> Đèn tín hiệu</button>
      <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}><Server size={16} /> Cài đặt</button>
      <button className={`tab-btn ${activeTab === 'integrations' ? 'active' : ''}`} onClick={() => setActiveTab('integrations')}><ExternalLink size={16} /> Tích hợp API</button>
    </div>
  );

  return (
    <div className="admin-page">
      <div className="page-header"><h2>Quản trị hệ thống</h2></div>

      {renderTabs()}

      <div className="admin-content card">
        {activeTab === 'users' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h3>Quản lý người dùng</h3>
              <button className="btn btn-primary" onClick={() => setModal({ type: 'add_user' })}><Plus size={16} /> Thêm người dùng</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Đăng nhập cuối</th><th className="text-right">Thao tác</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.name}</td>
                      <td style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>{u.email}</td>
                      <td><span className="badge badge-purple">{USER_ROLES[u.role] || u.role}</span></td>
                      <td><span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`}>{u.status === 'active' ? 'HOẠT ĐỘNG' : 'VÔ HIỆU'}</span></td>
                      <td style={{ fontSize: 'var(--fs-xs)', fontVariantNumeric: 'tabular-nums' }}>{formatDateTime(u.lastLogin)}</td>
                      <td className="text-right actions-cell">
                        <button className="btn-icon" onClick={() => setModal({ type: 'edit_user', data: u })}><Edit2 size={14} /></button>
                        <button className="btn-icon text-red" onClick={() => handleDeleteUser(u.id)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'cameras' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h3>Cấu hình Camera</h3>
              <button className="btn btn-primary" onClick={() => setModal({ type: 'add_cam' })}><Plus size={16} /> Thêm Camera</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Tên</th><th>Hướng</th><th>Trạng thái</th><th className="text-right">Thao tác</th></tr>
                </thead>
                <tbody>
                  {cameras.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>{c.direction}</td>
                      <td><span className="badge badge-green">ONLINE</span></td>
                      <td className="text-right actions-cell">
                        <button className="btn-icon" title="Xem chi tiết" onClick={() => setModal({ type: 'detail_cam', data: c })}><Eye size={14} /></button>
                        <button className="btn-icon" onClick={() => setModal({ type: 'edit_cam', data: c })}><Edit2 size={14} /></button>
                        <button className="btn-icon text-red" onClick={() => {
                          if (confirm('Bạn có chắc muốn xóa camera này?')) setCameras(cameras.filter(cam => cam.id !== c.id));
                        }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="tab-pane">
            <div className="pane-header"><h3>Cài đặt hệ thống</h3></div>
            <form className="settings-list" onSubmit={handleSaveSettings}>
              <div className="setting-row"><span>Tần suất cập nhật dữ liệu</span><select defaultValue="5"><option value="1">1 giây</option><option value="5">5 giây</option><option value="10">10 giây</option></select></div>
              <div className="setting-row"><span>Thời gian lưu trữ dữ liệu</span><select defaultValue="90"><option value="30">30 ngày</option><option value="90">90 ngày</option><option value="365">1 năm</option></select></div>
              <div className="setting-row"><span>Chế độ fallback khi AI lỗi</span><select defaultValue="fixed"><option value="fixed">Fixed-time (mặc định)</option><option value="last">Giữ chu kỳ cuối</option></select></div>
              <div className="setting-row"><span>Múi giờ</span><input type="text" defaultValue="Asia/Ho_Chi_Minh" readOnly /></div>
              <div style={{ marginTop: 'var(--sp-4)' }}>
                <button type="submit" className="btn btn-primary">Lưu cài đặt</button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="tab-pane">
            <div className="pane-header"><h3>Tích hợp API</h3></div>
            <div className="api-list">
              {[
                { name: 'Bản đồ OpenStreetMap', status: 'connected' },
                { name: 'VOV Giao thông', status: 'disconnected' },
                { name: 'Cổng SMS Gateway', status: 'connected' },
                { name: 'Email SMTP', status: 'connected' },
              ].map(api => (
                <div className="api-row" key={api.name}>
                  <span>{api.name}</span>
                  <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                    <span className={`badge ${api.status === 'connected' ? 'badge-green' : 'badge-red'}`}>
                      {api.status === 'connected' ? 'KẾT NỐI' : 'NGẮT'}
                    </span>
                    <button className="btn btn-sm" onClick={() => handleToggleApi(api.name)}>
                      {api.status === 'connected' ? 'Ngắt kết nối' : 'Kết nối'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {activeTab === 'signals' && (
          <div className="tab-pane">
            <div className="pane-header">
              <h3>Quản lý Đèn tín hiệu</h3>
              <button className="btn btn-primary" onClick={() => setModal({ type: 'add_signal' })}><Plus size={16} /> Thêm cụm đèn</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Tên cụm đèn</th><th>Vị trí</th><th>IP Address</th><th>Trạng thái</th><th>Chế độ</th><th className="text-right">Thao tác</th></tr>
                </thead>
                <tbody>
                  {[
                    { id: 'bd', name: 'Đèn Bạch Đằng', location: 'Góc ngã 3 Bạch Đằng', ip: '192.168.1.101', status: 'active', mode: 'Tự động' },
                    { id: 'dbp', name: 'Đèn Điện Biên Phủ', location: 'Cầu vượt Điện Biên Phủ', ip: '192.168.1.102', status: 'active', mode: 'Tự động' },
                    { id: 'xvnt', name: 'Đèn Xô Viết Nghệ Tĩnh', location: 'Đầu đường XVNT', ip: '192.168.1.103', status: 'active', mode: 'Thủ công' },
                    { id: 'hx', name: 'Đèn Hàng Xanh', location: 'Vòng xoay Hàng Xanh', ip: '192.168.1.104', status: 'active', mode: 'Tự động' },
                  ].map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.name}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>{s.location}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 'var(--fs-sm)' }}>{s.ip}</td>
                      <td><span className={`badge ${s.status === 'active' ? 'badge-green' : 'badge-red'}`}>{s.status === 'active' ? 'HOẠT ĐỘNG' : 'LỖI'}</span></td>
                      <td><span className="badge badge-purple">{s.mode}</span></td>
                      <td className="text-right actions-cell">
                        <button className="btn-icon" title="Xem chi tiết" onClick={() => setModal({ type: 'detail_signal', data: s })}><Eye size={14} /></button>
                        <button className="btn-icon" onClick={() => setModal({ type: 'edit_signal', data: s })}><Edit2 size={14} /></button>
                        <button className="btn-icon text-red" onClick={() => {
                          if (confirm('Bạn có chắc muốn xóa cụm đèn này?')) alert('Đã xóa!');
                        }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal for Camera */}
      {modal && modal.type === 'detail_cam' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal admin-modal" onClick={e => e.stopPropagation()}>
            <h3>Thông tin Camera</h3>
            <div className="detail-grid">
              <div className="detail-row"><span className="detail-label">Tên thiết bị</span><span className="detail-value">{modal.data.name}</span></div>
              <div className="detail-row"><span className="detail-label">ID</span><span className="detail-value" style={{ fontFamily: 'monospace' }}>{modal.data.id}</span></div>
              <div className="detail-row"><span className="detail-label">Hướng / Vị trí</span><span className="detail-value">{modal.data.direction}</span></div>
              <div className="detail-row"><span className="detail-label">Tọa độ</span><span className="detail-value" style={{ fontFamily: 'monospace' }}>{modal.data.position ? modal.data.position.join(', ') : '—'}</span></div>
              <div className="detail-row"><span className="detail-label">URL Luồng</span><span className="detail-value" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{modal.data.url || '—'}</span></div>
              <div className="detail-row"><span className="detail-label">Trạng thái</span><span className="detail-value"><span className="badge badge-green">ONLINE</span></span></div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setModal(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal for Signal */}
      {modal && modal.type === 'detail_signal' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal admin-modal" onClick={e => e.stopPropagation()}>
            <h3>Thông tin Đèn tín hiệu</h3>
            <div className="detail-grid">
              <div className="detail-row"><span className="detail-label">Tên cụm đèn</span><span className="detail-value">{modal.data.name}</span></div>
              <div className="detail-row"><span className="detail-label">ID</span><span className="detail-value" style={{ fontFamily: 'monospace' }}>{modal.data.id}</span></div>
              <div className="detail-row"><span className="detail-label">Vị trí</span><span className="detail-value">{modal.data.location}</span></div>
              <div className="detail-row"><span className="detail-label">IP Address</span><span className="detail-value" style={{ fontFamily: 'monospace' }}>{modal.data.ip}</span></div>
              <div className="detail-row"><span className="detail-label">Trạng thái</span><span className="detail-value"><span className={`badge ${modal.data.status === 'active' ? 'badge-green' : 'badge-red'}`}>{modal.data.status === 'active' ? 'HOẠT ĐỘNG' : 'LỖI'}</span></span></div>
              <div className="detail-row"><span className="detail-label">Chế độ</span><span className="detail-value"><span className="badge badge-purple">{modal.data.mode}</span></span></div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setModal(null)}>Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal UI */}
      {modal && !modal.type.startsWith('detail_') && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal admin-modal" onClick={e => e.stopPropagation()}>
            <h3>{modal.type.includes('add') ? 'Thêm mới' : 'Chỉnh sửa'} {modal.type.includes('user') ? 'Người dùng' : modal.type.includes('signal') ? 'Đèn tín hiệu' : 'Camera'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', margin: 'var(--sp-4) 0' }}>

              {modal.type.includes('user') ? (
                <>
                  <div className="form-group">
                    <label>Họ tên</label>
                    <input type="text" defaultValue={modal.data?.name || ''} placeholder="Nhập họ tên..." />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" defaultValue={modal.data?.email || ''} placeholder="Nhập email..." />
                  </div>
                  <div className="form-group">
                    <label>Vai trò</label>
                    <select defaultValue={modal.data?.role || 'operator'}>
                      <option value="admin">Admin</option>
                      <option value="operator">Vận hành viên</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Trạng thái</label>
                    <select defaultValue={modal.data?.status || 'active'}>
                      <option value="active">Hoạt động</option>
                      <option value="inactive">Vô hiệu</option>
                    </select>
                  </div>
                </>
              ) : modal.type.includes('signal') ? (
                <>
                  <div className="form-group">
                    <label>Tên cụm đèn</label>
                    <input type="text" defaultValue={modal.data?.name || ''} placeholder="Ví dụ: Đèn Bạch Đằng" />
                  </div>
                  <div className="form-group">
                    <label>Vị trí</label>
                    <input type="text" defaultValue={modal.data?.location || ''} placeholder="Ví dụ: Góc ngã 3 Bạch Đằng" />
                  </div>
                  <div className="form-group">
                    <label>IP Address</label>
                    <input type="text" defaultValue={modal.data?.ip || ''} placeholder="192.168.1.xxx" />
                  </div>
                  <div className="form-group">
                    <label>Chế độ</label>
                    <select defaultValue={modal.data?.mode || 'Tự động'}>
                      <option value="Tự động">Tự động</option>
                      <option value="Thủ công">Thủ công</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Trạng thái</label>
                    <select defaultValue={modal.data?.status || 'active'}>
                      <option value="active">Hoạt động</option>
                      <option value="inactive">Lỗi</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Tên Camera</label>
                    <input type="text" defaultValue={modal.data?.name || ''} placeholder="Ví dụ: Camera 1 - Ngã tư..." />
                  </div>
                  <div className="form-group">
                    <label>Hướng / Vị trí</label>
                    <input type="text" defaultValue={modal.data?.direction || ''} placeholder="Ví dụ: Điện Biên Phủ" />
                  </div>
                  <div className="form-group">
                    <label>URL Luồng (Stream URL)</label>
                    <input type="text" defaultValue={modal.data?.url || ''} placeholder="https://..." />
                  </div>
                  <div className="form-group">
                    <label>Trạng thái</label>
                    <select defaultValue={modal.data?.status || 'active'}>
                      <option value="active">Online</option>
                      <option value="inactive">Offline</option>
                    </select>
                  </div>
                </>
              )}

            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setModal(null)}>Hủy</button>
              <button className="btn btn-primary" onClick={() => {
                alert('Đã lưu thành công!');
                setModal(null);
              }}>Lưu lại</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
