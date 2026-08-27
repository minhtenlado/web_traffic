import { useState } from 'react';
import { Search, Download } from 'lucide-react';
import useStore from '../../stores/trafficStore';
import { formatDateTime } from '../../utils/formatters';
import './AuditLog.css';

export default function AuditLog() {
  const logs = useStore(s => s.auditLog);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('All');

  const filtered = logs.filter(l => {
    const matchSearch = l.user.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase());
    const matchUser = userFilter === 'All' || l.user === userFilter;
    return matchSearch && matchUser;
  });

  // Extract unique users for dropdowns
  const uniqueUsers = ['All', ...new Set(logs.map(l => l.user))];

  return (
    <div className="audit-page">
      <div className="page-header">
        <h2>Nhật ký & Kiểm toán</h2>
        <button className="btn"><Download size={14} /> Xuất CSV</button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, margin: 0 }}>
          <Search size={14} />
          <input
            type="text"
            placeholder="Tìm kiếm hành động, nội dung..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        
        <select 
          className="search-bar"
          value={userFilter} 
          onChange={e => setUserFilter(e.target.value)}
          style={{ width: '200px', cursor: 'pointer', appearance: 'auto' }}
        >
          <option value="All">Tất cả người dùng</option>
          {uniqueUsers.filter(u => u !== 'All').map(user => (
            <option key={user} value={user}>{user}</option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người dùng</th>
                <th>Vai trò</th>
                <th>Hành động</th>
                <th>Địa chỉ IP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 'var(--fs-xs)' }}>{formatDateTime(l.timestamp)}</td>
                  <td style={{ fontWeight: 500 }}>{l.user}</td>
                  <td><span className={`badge ${l.role === 'Tự động' ? 'badge-cyan' : 'badge-purple'}`}>{l.role}</span></td>
                  <td>{l.action}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)', fontFamily: 'monospace' }}>{l.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
