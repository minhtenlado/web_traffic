import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, ShieldAlert, Play, Pause, Lock, TrendingUp } from 'lucide-react';
import useStore from '../../stores/trafficStore';
import useAuthStore from '../../stores/authStore';
import { SIGNAL_PHASES, DIRECTIONS } from '../../utils/constants';
import './SignalControl.css';

export default function SignalControl() {
  const signal = useStore(s => s.signalState);
  const setMode = useStore(s => s.setSignalMode);
  const tick = useStore(s => s.tick);
  const isAdmin = useAuthStore(s => s.isAdmin());
  const [showConfirm, setShowConfirm] = useState(null);
  const [showEmergency, setShowEmergency] = useState(false);
  const routeStats = useStore(s => s.routeStats);

  useEffect(() => {
    // Handled by global socketService
  }, []);

  const handleModeToggle = () => {
    if (!isAdmin) return;
    const newMode = signal.mode === 'auto' ? 'manual' : 'auto';
    setShowConfirm(newMode);
  };

  const confirmMode = () => {
    setMode(showConfirm);
    setShowConfirm(null);
  };

  const currentPhase = SIGNAL_PHASES.find(p => p.id === signal.currentPhase);

  const getLightState = (dirId) => {
    const isActive = currentPhase?.directions?.includes(dirId);
    if (isActive) {
      if (signal.countdown > 3) {
        return { color: 'green', count: signal.countdown - 3 };
      } else {
        return { color: 'yellow', count: signal.countdown };
      }
    }
    return { color: 'red', count: signal.countdown };
  };

  const renderLight = (dirId, name, className, isHorizontal = false) => {
    const { color, count } = getLightState(dirId);
    return (
      <div className={`diagram-light ${isHorizontal ? 'row' : 'col'} ${className} is-${color}`}>
        {(!isHorizontal || className === 'light-bachdang' || className === 'light-dbp') && <span className="road-label">{name}</span>}
        <div className={`traffic-light-mini ${isHorizontal ? 'horizontal' : ''}`}>
          <div className="light-bulb red" />
          <div className="light-bulb yellow" />
          <div className="light-bulb green" />
          <div className="light-countdown">{count}</div>
        </div>
        {(isHorizontal && className === 'light-hangxanh') && <span className="road-label">{name}</span>}
      </div>
    );
  };

  return (
    <div className="signal-page">
      <div className="page-header">
        <h2>Điều khiển đèn tín hiệu</h2>
        <button 
          className="btn btn-danger emergency-btn" 
          onClick={() => isAdmin && setShowEmergency(true)}
          style={{ opacity: isAdmin ? 1 : 0.5, cursor: isAdmin ? 'pointer' : 'not-allowed' }}
          title={isAdmin ? "Dừng khẩn cấp" : "Chỉ Quản trị viên mới có quyền"}
        >
          {isAdmin ? <ShieldAlert size={16} /> : <Lock size={16} />} DỪNG KHẨN CẤP
        </button>
      </div>

      <div className="signal-content">
        {/* Left Side: Controls */}
        <div className="signal-controls">
          <div className="card mode-card">
            <div className="card-header">
              Chế độ điều khiển 
              {!isAdmin && <span style={{ fontSize: '10px', color: 'var(--red)', marginLeft: '8px' }}>(Chỉ xem)</span>}
            </div>
            <div className="mode-toggle">
              <button 
                className={`mode-btn ${signal.mode === 'auto' ? 'active auto' : ''}`} 
                onClick={handleModeToggle}
                style={{ cursor: isAdmin ? 'pointer' : 'not-allowed' }}
              >
                <Play size={16} /> Tự động (AI)
              </button>
              <button 
                className={`mode-btn ${signal.mode === 'manual' ? 'active manual' : ''}`} 
                onClick={handleModeToggle}
                style={{ cursor: isAdmin ? 'pointer' : 'not-allowed' }}
              >
                <Pause size={16} /> Thủ công
              </button>
            </div>
            <div className="mode-info" style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
              Chu kỳ hiện tại: <strong>#{signal.cycleNumber}</strong>
            </div>
          </div>

          <div className="card">
            <div className="card-header">Thời lượng các pha (giây)</div>
            <div className="phase-list">
              {SIGNAL_PHASES.map(phase => (
                <div className={`phase-row ${phase.id === signal.currentPhase ? 'active' : ''}`} key={phase.id}>
                  <span className="phase-name">{phase.name}</span>
                  <div className="phase-bar-bg">
                    <div
                      className="phase-bar"
                      style={{ width: `${(signal.phaseDurations[phase.id] / 45) * 100}%` }}
                    />
                  </div>
                  <span className="phase-duration">{signal.phaseDurations[phase.id]}s</span>
                </div>
              ))}
            </div>
          </div>

          {/* Real-time traffic volume per direction */}
          <div className="card traffic-volume-card">
            <div className="card-header">
              <TrendingUp size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Lưu lượng theo tuyến
            </div>
            <div className="volume-list">
              {routeStats.map(r => {
                const light = getLightState(r.id);
                return (
                  <div key={r.id} className={`volume-row is-${light.color}`}>
                    <div className="vol-header">
                      <span className="vol-name">{r.name}</span>
                      <span className={`vol-status vol-${r.statusColor}`}>{r.status}</span>
                    </div>
                    <div className="vol-bar-row">
                      <div className="vol-bar-wrap">
                        <div
                          className="vol-bar"
                          style={{
                            width: `${r.density}%`,
                            background: r.statusColor === 'red' ? '#ef4444' : r.statusColor === 'amber' ? '#f59e0b' : '#22c55e',
                          }}
                        />
                      </div>
                      <span className="vol-count">{r.vehicleCount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Realistic Diagram based on actual map */}
        <div className="card signal-diagram-card">
          <div className="diagram-header">
            <h3>ĐANG CHẠY {currentPhase?.name.toUpperCase()}</h3>
          </div>
          
          <div className="intersection-container">
            {/* Roads matching the real Hang Xanh topography */}
            <div className="road road-xvnt">
              <div className="road-line xvnt-line" />
            </div>
            
            <div className="road road-dbp">
              <div className="road-line dbp-line" />
            </div>
            
            <div className="road road-bachdang">
              <div className="road-line bch-line" />
            </div>

            {/* Roundabout Island */}
            <div className="roundabout">
              <div className="roundabout-island"></div>
            </div>

            {/* Overpass Bridge */}
            <div className="overpass">
              <div className="overpass-divider" />
            </div>
            
            {/* Traffic Lights with built-in countdowns */}
            {renderLight('bach_dang', 'Bạch Đằng', 'light-bachdang', true)}
            {renderLight('dien_bien_phu', 'Điện Biên Phủ', 'light-dbp', true)}
            {renderLight('xo_viet_nghe_tinh', 'Xô Viết Nghệ Tĩnh', 'light-xvnt', false)}
            {renderLight('hang_xanh', 'Hàng Xanh', 'light-hangxanh', true)}
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="modal-backdrop" onClick={() => setShowConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Xác nhận chuyển chế độ</h3>
            <p>Bạn có chắc muốn chuyển sang chế độ <strong>{showConfirm === 'auto' ? 'Tự động (AI)' : 'Thủ công'}</strong>?</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowConfirm(null)}>Hủy</button>
              <button className="btn btn-primary" onClick={confirmMode}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency modal */}
      {showEmergency && (
        <div className="modal-backdrop" onClick={() => setShowEmergency(false)}>
          <div className="modal emergency-modal" onClick={e => e.stopPropagation()}>
            <AlertTriangle size={32} color="var(--red)" />
            <h3>DỪNG KHẨN CẤP</h3>
            <p>Tất cả đèn sẽ chuyển sang đỏ. Hành động này cần xác nhận của người quản trị.</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowEmergency(false)}>Hủy</button>
              <button className="btn btn-danger" onClick={() => setShowEmergency(false)}>XÁC NHẬN DỪNG</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
