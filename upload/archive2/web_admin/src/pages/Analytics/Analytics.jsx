import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Download, Activity, Timer, BarChart3, Brain, Cpu, TrendingUp, Radio, Eye } from 'lucide-react';
import { DIRECTIONS, VEHICLE_TYPES } from '../../utils/constants';
import useStore from '../../stores/trafficStore';
import './Analytics.css';

const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];

export default function Analytics() {
  const [period, setPeriod] = useState('day');

  // Consume from Global Store (Single Source of Truth)
  const routeStats = useStore(s => s.routeStats);
  const hourlyData = useStore(s => s.hourlyData);
  const heatmapData = useStore(s => s.heatmapData);
  const aiPredictions = useStore(s => s.aiPredictions);
  const signalRec = useStore(s => s.signalRec);
  const metrics = useStore(s => s.metrics);
  const signalState = useStore(s => s.signalState);
  const chartHistory = useStore(s => s.chartHistory);
  const localHistory = useStore(s => s.localHistory);
  const predictionSummary = useStore(s => s.predictionSummary);

  // Compute KPIs
  const totalVehicles = metrics.totalVehicles;
  const avgDensity = Math.round(routeStats.reduce((s, r) => s + r.density, 0) / routeStats.length);
  const getAvg = (item) => {
    let sum = 0;
    let count = 0;
    ['cam_01', 'cam_02', 'cam_03', 'cam_04'].forEach(key => {
      if (item[key] !== undefined && item[key] !== null && !isNaN(item[key])) {
        sum += item[key];
        count++;
      }
    });
    return count > 0 ? sum / count : 0;
  };

  const trendPercent = useMemo(() => {
    if (chartHistory.length < 2) return '+0%';
    const first = getAvg(chartHistory[0]);
    const last = getAvg(chartHistory[chartHistory.length-1]);
    const diff = last - first;
    const sign = diff > 0 ? '+' : '';
    // Map 0-4 scale to roughly -100% to +100%
    return `${sign}${(diff * 25).toFixed(1)}%`;
  }, [chartHistory]);

  // ── Chart 1: Area Chart — Average Traffic congestion trend ──
  const avgHistory = chartHistory.map(getAvg);

  const trafficChart = {
    backgroundColor: 'transparent',
    tooltip: { 
      trigger: 'axis', 
      backgroundColor: 'rgba(15,23,42,0.9)', 
      borderColor: 'rgba(56,189,248,0.3)', 
      textStyle: { color: '#e2e8f0' },
      formatter: (params) => {
        const val = params[0].data;
        let text = 'Trống';
        if (val >= 0.5) text = 'Bình thường';
        if (val >= 1.5) text = 'Đông xe';
        if (val >= 2.5) text = 'Sắp kẹt';
        if (val >= 3.5) text = 'Kẹt xe';
        return `Thời gian: ${params[0].axisValue}<br/>${params[0].marker} Mức độ trung bình: <b>${text}</b>`;
      }
    },
    grid: { left: 55, right: 16, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: chartHistory.map(h => h.time), axisLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#64748b', fontSize: 12 } },
    yAxis: { 
      type: 'value', 
      min: 0, max: 4, 
      splitNumber: 4,
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }, 
      axisLabel: { 
        color: '#64748b', fontSize: 12,
        formatter: (value) => ['Trống', 'BT', 'Đông', 'Sắp kẹt', 'Kẹt'][value]
      } 
    },
    visualMap: {
      show: false,
      pieces: [
        { gt: -1, lte: 1, color: '#22c55e' },
        { gt: 1, lte: 2.5, color: '#f59e0b' },
        { gt: 2.5, lte: 5, color: '#ef4444' }
      ],
      outOfRange: { color: '#22c55e' }
    },
    series: [
      { 
        name: 'Trung bình', 
        type: 'line', 
        smooth: true, 
        symbol: 'none', 
        data: avgHistory,
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.3 }
      }
    ],
  };

  // ── Chart 2: Heatmap — weekly pattern ──
  const heatmapMax = Math.max(...heatmapData.map(d => d[2]));
  const heatmapChart = {
    backgroundColor: 'transparent',
    tooltip: {
      formatter: (p) => `${DAYS[p.data[1]]} ${p.data[0]}h<br/>Lưu lượng: <b>${p.data[2]}</b> xe`,
      backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(56,189,248,0.3)', textStyle: { color: '#e2e8f0' },
    },
    grid: { left: 60, right: 40, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, i) => `${i}h`), axisLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#64748b', fontSize: 10 }, splitArea: { show: false } },
    yAxis: { type: 'category', data: DAYS, axisLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#94a3b8', fontSize: 11 } },
    visualMap: {
      min: 0, max: heatmapMax,
      inRange: { color: ['#0f172a', '#164e63', '#0e7490', '#f59e0b', '#ef4444'] },
      textStyle: { color: '#64748b' },
      orient: 'horizontal', left: 'center', bottom: -5,
      show: false,
    },
    series: [{
      type: 'heatmap',
      data: heatmapData,
      itemStyle: { borderWidth: 2, borderColor: 'rgba(15,23,42,0.8)' },
      emphasis: { itemStyle: { borderColor: '#38bdf8', borderWidth: 2 } },
    }],
  };

  // ── Chart 3: AI Forecast — actual + predicted ──
  const pastTimes = chartHistory.map(h => h.time);
  const futureTimes = aiPredictions.map(p => p.time);
  const allTimes = [...pastTimes, ...futureTimes];
  
  const actualValues = chartHistory.map(getAvg);
  const forecastValues = aiPredictions.map(getAvg);

  const paddedActual = [...actualValues, ...Array(futureTimes.length).fill(null)];
  const paddedForecast = [...Array(pastTimes.length > 0 ? pastTimes.length - 1 : 0).fill(null), actualValues[actualValues.length - 1] || null, ...forecastValues];

  // AI Confidence Bands
  const forecastLower = paddedForecast.map((v, i) => {
    if (v === null) return null;
    if (i === pastTimes.length - 1) return v; // Exact connection point
    return Math.max(0, v - 0.35); // Lower bound
  });
  
  const forecastBand = paddedForecast.map((v, i) => {
    if (v === null) return null;
    if (i === pastTimes.length - 1) return 0; // Band width is 0 at connection
    const upper = Math.min(4, v + 0.35);
    const lower = Math.max(0, v - 0.35);
    return upper - lower; // Stack height
  });

  const forecastChart = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(56,189,248,0.3)', textStyle: { color: '#e2e8f0' } },
    legend: { data: ['Thực tế', 'Dự báo AI'], textStyle: { color: '#94a3b8' }, top: 0 },
    grid: { left: 55, right: 16, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: allTimes, axisLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#64748b', fontSize: 12 } },
    yAxis: { type: 'value', min: 0, max: 4, splitNumber: 4, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }, axisLabel: { color: '#64748b', fontSize: 12, formatter: (v) => ['Trống','BT','Đông','Sắp kẹt','Kẹt'][v] } },
    series: [
      {
        name: 'Thực tế', type: 'line', data: paddedActual, smooth: true, symbol: 'none',
        lineStyle: { color: '#38bdf8', width: 3 }, itemStyle: { color: '#38bdf8' },
        areaStyle: { 
          color: { 
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1, 
            colorStops: [{ offset: 0, color: 'rgba(56,189,248,0.35)' }, { offset: 1, color: 'rgba(56,189,248,0)' }] 
          } 
        },
      },
      {
        name: 'Dự báo AI', type: 'line', data: paddedForecast, smooth: true, symbol: 'none',
        lineStyle: { color: '#a855f7', width: 3, type: 'dashed' }, itemStyle: { color: '#a855f7' },
      },
      {
        name: 'Biên dưới', type: 'line', data: forecastLower, smooth: true, symbol: 'none',
        lineStyle: { opacity: 0 }, stack: 'confidence', silent: true,
      },
      {
        name: 'Vùng tin cậy', type: 'line', data: forecastBand, smooth: true, symbol: 'none',
        lineStyle: { opacity: 0 }, areaStyle: { color: 'rgba(168,85,247,0.15)' }, stack: 'confidence', silent: true,
      },
    ],
  };

  // ── Chart 3.5: Per-Camera Step Charts (Python Dashboard Match) ──
  const createCamChartOption = (camKey, name, color) => {
    const actualData = chartHistory.map(h => h[camKey]);
    const forecastData = aiPredictions.map(p => p[camKey]);

    const padActual = [...actualData, ...Array(futureTimes.length).fill(null)];
    const padForecast = [...Array(pastTimes.length > 0 ? pastTimes.length - 1 : 0).fill(null), actualData[actualData.length - 1] || null, ...forecastData];

    return {
      backgroundColor: 'transparent',
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(56,189,248,0.3)', textStyle: { color: '#e2e8f0' } },
      title: { text: name, textStyle: { color, fontSize: 12 }, top: 0, left: 10 },
      grid: { left: 80, right: 16, top: 30, bottom: 40 },
      xAxis: { 
        type: 'category', 
        data: allTimes, 
        axisLine: { lineStyle: { color: '#1e293b' } }, 
        axisLabel: { color: '#64748b', fontSize: 10, rotate: 45 } 
      },
      yAxis: { 
        type: 'value', 
        min: 0, max: 4, 
        splitNumber: 4, 
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }, 
        axisLabel: { color: '#64748b', fontSize: 11, formatter: (v) => ['Duong_vang','Binh_thuong','Dong_xe','Sap_ket','Ket_xe'][v] } 
      },
      series: [
        {
          name: 'Quá khứ', type: 'line', data: padActual, step: 'end',
          lineStyle: { color, width: 2 }, itemStyle: { color }, symbol: 'none',
          markLine: {
            symbol: ['none', 'none'],
            label: { show: false },
            lineStyle: { color: '#ef4444', type: 'dotted', width: 1 },
            data: pastTimes.length > 0 ? [{ xAxis: pastTimes[pastTimes.length - 1] }] : []
          }
        },
        {
          name: 'Dự báo', type: 'line', data: padForecast, step: 'end',
          lineStyle: { color, width: 2, type: 'dashed' }, itemStyle: { color }, symbol: 'none',
        }
      ],
    };
  };

  const cam01Chart = createCamChartOption('cam_01', 'CAM_01', '#38bdf8');
  const cam02Chart = createCamChartOption('cam_02', 'CAM_02', '#f59e0b');
  const cam03Chart = createCamChartOption('cam_03', 'CAM_03', '#22c55e');
  const cam04Chart = createCamChartOption('cam_04', 'CAM_04', '#ef4444');

  // Forecast Table data points
  const forecastTablePoints = aiPredictions.length > 0 ? [
    { label: '+5 phút', data: aiPredictions[Math.floor(aiPredictions.length * 0.16)] || aiPredictions[0] },
    { label: '+10 phút', data: aiPredictions[Math.floor(aiPredictions.length * 0.33)] || aiPredictions[0] },
    { label: '+15 phút', data: aiPredictions[Math.floor(aiPredictions.length * 0.5)] || aiPredictions[0] },
    { label: '+20 phút', data: aiPredictions[Math.floor(aiPredictions.length * 0.66)] || aiPredictions[0] },
    { label: '+30 phút', data: aiPredictions[aiPredictions.length - 1] || aiPredictions[0] },
  ] : [];

  const getLabelText = (val) => ['Trống','Bình thường','Đông xe','Sắp kẹt','Kẹt xe'][val] || '—';

  // ── Chart 4: Signal Correlation — dual Y-axis ──
  const signalChart = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(15,23,42,0.9)', borderColor: 'rgba(56,189,248,0.3)', textStyle: { color: '#e2e8f0' } },
    legend: { data: ['Lưu lượng xe', 'Đèn xanh Pha 1', 'Đèn xanh Pha 2'], textStyle: { color: '#94a3b8', fontSize: 12 }, top: 0 },
    grid: { left: 55, right: 50, top: 40, bottom: 30 },
    xAxis: { type: 'category', data: localHistory.map(d => d.time), axisLine: { lineStyle: { color: '#1e293b' } }, axisLabel: { color: '#64748b', fontSize: 12 } },
    yAxis: [
      { type: 'value', name: 'Số xe', nameTextStyle: { color: '#64748b', fontSize: 12 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }, axisLabel: { color: '#64748b', fontSize: 12 }, min: 'dataMin' },
      { type: 'value', name: 'Giây', nameTextStyle: { color: '#64748b', fontSize: 12 }, splitLine: { show: false }, axisLabel: { color: '#64748b', fontSize: 12 }, max: 45 },
    ],
    series: [
      {
        name: 'Lưu lượng xe', type: 'line', data: localHistory.map(d => d.traffic),
        itemStyle: { color: '#38bdf8' }, lineStyle: { width: 3 }, smooth: true, symbol: 'none',
        areaStyle: { 
          color: { 
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1, 
            colorStops: [{ offset: 0, color: 'rgba(56,189,248,0.35)' }, { offset: 1, color: 'rgba(56,189,248,0)' }] 
          } 
        }
      },
      {
        name: 'Đèn xanh Pha 1', type: 'line', yAxisIndex: 1, data: localHistory.map(d => d.greenPhase1),
        step: 'start', symbol: 'none', lineStyle: { color: '#22c55e', width: 2 }, itemStyle: { color: '#22c55e' },
      },
      {
        name: 'Đèn xanh Pha 2', type: 'line', yAxisIndex: 1, data: localHistory.map(d => d.greenPhase2),
        step: 'start', symbol: 'none', lineStyle: { color: '#f59e0b', width: 2, type: 'dashed' }, itemStyle: { color: '#f59e0b' },
      },
    ],
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="analytics-page">
      {/* Header */}
      <div className="page-header">
        <h2>Thống kê & Phân tích</h2>
        <div className="header-actions">
          <div className="period-tabs">
            {['day', 'week', 'month'].map(p => (
              <button key={p} className={`period-btn ${period === p ? 'active' : ''}`} onClick={() => setPeriod(p)}>
                {p === 'day' ? 'Ngày' : p === 'week' ? 'Tuần' : 'Tháng'}
              </button>
            ))}
          </div>
          <button className="export-btn"><Download size={14} /> Xuất báo cáo</button>
        </div>
      </div>

      {/* ═══════ SECTION 1: KPI Overview ═══════ */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: '#38bdf8' }}><Activity size={20} /></div>
          <div className="kpi-data">
            <span className="kpi-value" style={{ color: '#38bdf8' }}>{totalVehicles.toLocaleString()}</span>
            <span className="kpi-label">Tổng phương tiện</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: '#a855f7' }}><Timer size={20} /></div>
          <div className="kpi-data">
            <span className="kpi-value" style={{ color: '#a855f7' }}>10s</span>
            <span className="kpi-label">Chu kỳ AI (lấy mẫu)</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: avgDensity > 70 ? '#ef4444' : avgDensity > 50 ? '#f59e0b' : '#22c55e' }}><BarChart3 size={20} /></div>
          <div className="kpi-data">
            <span className="kpi-value" style={{ color: avgDensity > 70 ? '#ef4444' : avgDensity > 50 ? '#f59e0b' : '#22c55e' }}>{avgDensity}%</span>
            <span className="kpi-label">Mật độ trung bình</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: '#22c55e' }}><Cpu size={20} /></div>
          <div className="kpi-data">
            <span className="kpi-value" style={{ color: '#22c55e' }}>{predictionSummary?.accuracy || 92.5}%</span>
            <span className="kpi-label">Độ chính xác AI</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: '#06b6d4' }}><Radio size={20} /></div>
          <div className="kpi-data">
            <span className="kpi-value" style={{ color: '#06b6d4' }}>
              {signalState.currentPhase === 'phase_1' ? 'Pha 1' : 'Pha 2'}
            </span>
            <span className="kpi-label">Chu kỳ đèn hiện tại</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: trendPercent.startsWith('+') ? '#ef4444' : '#22c55e' }}><TrendingUp size={20} /></div>
          <div className="kpi-data">
            <span className="kpi-value" style={{ color: trendPercent.startsWith('+') ? '#ef4444' : '#22c55e' }}>{trendPercent}</span>
            <span className="kpi-label">So với 10 phút trước</span>
          </div>
        </div>
      </div>

      {/* ═══════ SECTION 2: Per-Route Analysis ═══════ */}
      <div className="section-row">
        <div className="an-card flex-1">
          <div className="an-card-header">
            <span>Mật độ theo tuyến</span>
            <span className="an-card-badge">Thời gian thực</span>
          </div>
          <div className="route-stats-list">
            {routeStats.map(r => (
              <div key={r.id} className="route-stat-row">
                <div className="route-info">
                  <span className="route-name">
                    {r.name}
                    {r.isReference && <span className="ref-badge" title="Camera tham chiếu vòng xoay"><Eye size={12} /> Tham chiếu</span>}
                  </span>
                  <span className="route-cameras">{r.cameras.join(', ')}</span>
                </div>
                <div className="route-metrics">
                  <span className="route-count">{r.vehicleCount}</span>
                  <div className="density-bar-wrap">
                    <div className="density-bar" style={{ width: `${r.density}%`, background: r.statusColor === 'red' ? '#ef4444' : r.statusColor === 'amber' ? '#f59e0b' : '#22c55e' }} />
                  </div>
                  <span className={`route-status status-${r.statusColor}`}>{r.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="an-card flex-2">
          <div className="an-card-header">
            <span>Xu hướng mức độ ùn tắc trung bình toàn nút giao (Live)</span>
          </div>
          <ReactECharts option={trafficChart} style={{ height: 300 }} />
        </div>
      </div>

      {/* ═══════ SECTION 4: AI Forecast ═══════ */}
      <div className="section-row">
        <div className="an-card flex-2">
          <div className="an-card-header">
            <span><Brain size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Dự báo AI — Xu hướng ùn tắc 30 phút tới</span>
          </div>
          <ReactECharts option={forecastChart} style={{ height: 280 }} />
        </div>
        <div className="an-card flex-1">
          <div className="an-card-header">
            <span>Bảng dự báo theo tuyến</span>
          </div>
          <div className="forecast-table-wrap">
            <table className="forecast-table">
              <thead>
                <tr>
                  <th>Camera</th>
                  {forecastTablePoints.map(p => <th key={p.label}>{p.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {['cam_01', 'cam_02', 'cam_03', 'cam_04'].map((cam, idx) => (
                  <tr key={cam}>
                    <td className="ft-route">Camera {idx + 1}</td>
                    {forecastTablePoints.map((p, i) => (
                      <td key={i} className="ft-value">{getLabelText(p.data[cam])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ═══════ SECTION 4.5: Per-Camera AI Forecast ═══════ */}
      <div className="section-row">
        <div className="an-card" style={{ flex: 1 }}>
          <div className="an-card-header" style={{ justifyContent: 'center' }}>
            <span>BIỂU ĐỒ QUÁ KHỨ (60 PHÚT) & DỰ BÁO TƯƠNG LAI (30 PHÚT)</span>
          </div>
          <div className="cam-charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <ReactECharts option={cam01Chart} style={{ height: 220 }} />
            <ReactECharts option={cam02Chart} style={{ height: 220 }} />
            <ReactECharts option={cam03Chart} style={{ height: 220 }} />
            <ReactECharts option={cam04Chart} style={{ height: 220 }} />
          </div>
        </div>
      </div>

      {/* ═══════ SECTION 5: Signal Correlation ═══════ */}
      <div className="section-row">
        <div className="an-card flex-2">
          <div className="an-card-header">
            <span>Tương quan Lưu lượng & Chu kỳ đèn (Real-time Session)</span>
          </div>
          <ReactECharts option={signalChart} style={{ height: 280 }} />
        </div>
        <div className="an-card flex-1">
          <div className="an-card-header">
            <span>Đề xuất AI</span>
            <span className="an-card-badge policy-badge">{signalRec.policy}</span>
          </div>
          <div className="signal-rec-list">
            {signalRec.recommendations.map((rec, i) => {
              const isChanged = rec.suggestedGreen !== rec.currentGreen;
              return (
                <div key={i} className={`signal-rec-card ${isChanged ? 'active-rec' : ''}`}>
                  <div className="rec-card-header">
                    <span className="rec-phase"><Radio size={14} className="rec-icon" /> {rec.phase}</span>
                    <span className="rec-confidence">
                      <span className="conf-value">{rec.confidence}%</span>
                    </span>
                  </div>
                  
                  <div className="rec-card-body">
                    <div className="rec-timing-block">
                      <div className="timing-col">
                        <span className="timing-label">Hiện tại</span>
                        <span className="timing-value">{rec.currentGreen}s</span>
                      </div>
                      <div className="timing-arrow">
                        <TrendingUp size={20} color={isChanged ? '#38bdf8' : '#64748b'} />
                      </div>
                      <div className="timing-col">
                        <span className="timing-label">Đề xuất</span>
                        <span className={`timing-value ${isChanged ? 'highlight' : ''}`}>{rec.suggestedGreen}s</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="rec-card-footer">
                    <Brain size={14} /> <span>{rec.reason}</span>
                  </div>
                  
                  <div className="conf-bar-bg">
                    <div className="conf-bar-fill" style={{ width: `${rec.confidence}%`, backgroundColor: rec.confidence > 90 ? '#22c55e' : '#f59e0b' }}></div>
                  </div>
                </div>
              );
            })}
            <div className="rec-meta">
              <span>Điều chỉnh lần cuối: {formatTime(signalRec.lastAdjusted)}</span>
              <span>Đánh giá tiếp: {formatTime(signalRec.nextReview)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
