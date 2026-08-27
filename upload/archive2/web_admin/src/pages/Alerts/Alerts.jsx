import { useState } from 'react';
import { Bell, Check, Filter } from 'lucide-react';
import useStore from '../../stores/trafficStore';
import { ALERT_TYPES } from '../../utils/constants';
import { formatDateTime } from '../../utils/formatters';
import './Alerts.css';

export default function Alerts() {
  const alerts = useStore(s => s.alerts);
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.type === filter);

  const severityOrder = { critical: 0, warning: 1, info: 2 };
  const sorted = [...filtered].sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return (
    <div className="alerts-page">
      <div className="page-header">
        <h2>Cảnh báo & Sự kiện</h2>
        <span className="alert-summary">{alerts.filter(a => !a.acknowledged).length} chưa xử lý</span>
      </div>

      <div className="filter-bar">
        <button className={`btn ${filter === 'all' ? 'btn-primary' : ''}`} onClick={() => setFilter('all')}>Tất cả</button>
        {Object.entries(ALERT_TYPES).map(([key, val]) => (
          <button key={key} className={`btn ${filter === key ? 'btn-primary' : ''}`} onClick={() => setFilter(key)}>{val.label}</button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mức độ</th>
                <th>Loại</th>
                <th>Nội dung</th>
                <th>Camera</th>
                <th>Thời gian</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(a => (
                <tr key={a.id}>
                  <td>
                    <span className={`badge badge-${a.severity === 'critical' ? 'red' : a.severity === 'warning' ? 'amber' : 'cyan'}`}>
                      {a.severity === 'critical' ? 'NGHIÊM TRỌNG' : a.severity === 'warning' ? 'CẢNH BÁO' : 'THÔNG TIN'}
                    </span>
                  </td>
                  <td><span className={`badge badge-${a.color}`}>{a.label}</span></td>
                  <td>{a.message}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-xs)' }}>{a.camera}</td>
                  <td style={{ fontSize: 'var(--fs-xs)', fontVariantNumeric: 'tabular-nums' }}>{formatDateTime(a.timestamp)}</td>
                  <td>{a.acknowledged ? <span className="badge badge-green">ĐÃ XỬ LÝ</span> : <span className="badge badge-amber">CHỜ</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Threshold config */}
      <div className="card">
        <div className="card-header">Cấu hình ngưỡng cảnh báo</div>
        <div className="threshold-grid">
          <div className="threshold-item">
            <label>Mật độ xe tối đa (xe/phút)</label>
            <input type="number" defaultValue={120} />
          </div>
          <div className="threshold-item">
            <label>Tốc độ tối thiểu (km/h)</label>
            <input type="number" defaultValue={5} />
          </div>
          <div className="threshold-item">
            <label>Thời gian chờ tối đa (giây)</label>
            <input type="number" defaultValue={120} />
          </div>
          <div className="threshold-item">
            <label>Thông báo qua</label>
            <select defaultValue="all">
              <option value="all">Email + SMS</option>
              <option value="email">Chỉ Email</option>
              <option value="sms">Chỉ SMS</option>
            </select>
          </div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 'var(--sp-4)' }}>Lưu cấu hình</button>
      </div>
    </div>
  );
}
