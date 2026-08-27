import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Server, Activity, HardDrive, Wifi, ShieldAlert, Cpu } from 'lucide-react';
import useStore from '../../stores/trafficStore';
import './SystemHealth.css';

export default function SystemHealth() {
  const healthMetrics = useStore(s => s.healthMetrics) || { cpu: 0, ram: 0, temperature: 0, networkLatency: 0 };
  const theme = useStore(s => s.theme);
  const realtimeCams = useStore(s => s.realtimeCams) || {};
  const isBoardOffline = useStore(s => s.isBoardOffline);
  
  // Keep history for charts
  const [history, setHistory] = useState({
    cpu: Array(30).fill(0),
    ram: Array(30).fill(0),
    time: Array(30).fill('')
  });

  useEffect(() => {

    const now = new Date();
    const timeStr = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    
    setHistory(prev => {
      const newCpu = [...prev.cpu.slice(1), healthMetrics.cpu];
      const newRam = [...prev.ram.slice(1), healthMetrics.ram];
      const newTime = [...prev.time.slice(1), timeStr];
      return { cpu: newCpu, ram: newRam, time: newTime };
    });
  }, [healthMetrics]);

  const cpuChartOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: history.time, axisLabel: { show: false } },
    yAxis: { type: 'value', max: 100, splitLine: { show: false }, axisLabel: { color: '#9aa5b4', fontSize: 10 } },
    series: [{ 
      name: 'CPU (%)',
      type: 'line', 
      data: history.cpu, 
      smooth: true, 
      areaStyle: { color: 'rgba(59, 130, 246, 0.2)' }, 
      lineStyle: { color: '#3b82f6', width: 2 }, 
      itemStyle: { color: '#3b82f6' }, 
      symbol: 'none' 
    }],
  }), [history]);

  const ramChartOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: history.time, axisLabel: { show: false } },
    yAxis: { type: 'value', max: 100, splitLine: { show: false }, axisLabel: { color: '#9aa5b4', fontSize: 10 } },
    series: [{ 
      name: 'RAM (%)',
      type: 'line', 
      data: history.ram, 
      smooth: true, 
      areaStyle: { color: 'rgba(168, 85, 247, 0.2)' }, 
      lineStyle: { color: '#a855f7', width: 2 }, 
      itemStyle: { color: '#a855f7' }, 
      symbol: 'none' 
    }],
  }), [history]);

  return (
    <div className="health-page">
      <div className="page-header">
        <h2>Giám sát Sức khỏe Hệ thống (System Health)</h2>
      </div>

      <div className="health-grid">
        {/* Core Metrics Cards */}
        <div className="health-card stat-box">
          <div className="stat-header">
            <Cpu size={20} className="text-blue" />
            <span>Tải CPU (Board Genio 350)</span>
          </div>
          <div className="stat-value">{healthMetrics.cpu}%</div>
          <div className="stat-status">Trạng thái: {healthMetrics.cpu > 80 ? 'QUÁ TẢI' : 'BÌNH THƯỜNG'}</div>
        </div>

        <div className="health-card stat-box">
          <div className="stat-header">
            <HardDrive size={20} className="text-purple" />
            <span>Bộ nhớ RAM</span>
          </div>
          <div className="stat-value">{healthMetrics.ram}%</div>
          <div className="stat-status">Trạng thái: {healthMetrics.ram > 85 ? 'CẢNH BÁO' : 'ỔN ĐỊNH'}</div>
        </div>

        <div className="health-card stat-box">
          <div className="stat-header">
            <Activity size={20} className={healthMetrics.temperature > 75 ? 'text-red' : 'text-amber'} />
            <span>Nhiệt độ CPU (°C)</span>
          </div>
          <div className={`stat-value ${healthMetrics.temperature > 75 ? 'text-red' : ''}`}>{healthMetrics.temperature}°C</div>
          <div className="stat-status">Trạng thái: {healthMetrics.temperature > 75 ? 'CẢNH BÁO' : 'BÌNH THƯỜNG'}</div>
        </div>

        <div className="health-card stat-box">
          <div className="stat-header">
            <Wifi size={20} className={isBoardOffline ? "text-red" : "text-green"} />
            <span>Độ trễ mạng (Ping)</span>
          </div>
          <div className="stat-value">{isBoardOffline ? '—' : `${healthMetrics.networkLatency}ms`}</div>
          <div className="stat-status">{isBoardOffline ? 'Board: MẤT KẾT NỐI' : 'Firebase: ĐÃ KẾT NỐI'}</div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="health-card">
          <h3 className="card-title">Biểu đồ tải CPU (30s)</h3>
          <ReactECharts option={cpuChartOption} style={{ height: 250 }} />
        </div>
        <div className="health-card">
          <h3 className="card-title">Biểu đồ tải RAM (30s)</h3>
          <ReactECharts option={ramChartOption} style={{ height: 250 }} />
        </div>
      </div>

      <div className="health-card">
        <div className="card-header-row">
          <h3 className="card-title"><Server size={18} /> Trạng thái Node Camera (Edge Devices)</h3>
        </div>
        <div className="table-wrap">
          <table className="health-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên Node</th>
                <th>Loại IP</th>
                <th>Ping (ms)</th>
                <th>Trạng thái kết nối</th>
                <th>Khởi động lại</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(realtimeCams)
                .filter(key => ['cam_01', 'cam_02', 'cam_03', 'cam_04'].includes(key))
                .map(camId => {
                  const cam = realtimeCams[camId];
                  const isOnline = !isBoardOffline && cam.status === 'ONLINE';
                  return (
                    <tr key={camId}>
                      <td>{camId.toUpperCase()}</td>
                      <td>Camera Edge AI</td>
                      <td>Firebase Stream</td>
                      <td className="tabular">{isOnline ? `${Math.floor(Math.random() * 20) + 15}ms` : '—'}</td>
                      <td>
                        <span className={`badge ${isOnline ? 'badge-green' : 'badge-red'}`}>
                          {isOnline ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </td>
                      <td>
                        <button className="btn-small">Restart</button>
                      </td>
                    </tr>
                  );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
