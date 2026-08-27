import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { CheckCircle, Archive, TrendingUp, TrendingDown } from 'lucide-react';
import { generateModelInfo } from '../../services/mockData';
import { formatDateTime } from '../../utils/formatters';
import './ModelManagement.css';

export default function ModelManagement() {
  const model = useMemo(() => generateModelInfo(), []);

  const pipelineSteps = [
    { label: 'Thu thập dữ liệu', status: 'done' },
    { label: 'Gán nhãn', status: 'done' },
    { label: 'Huấn luyện', status: 'done' },
    { label: 'Đánh giá', status: 'done' },
    { label: 'Triển khai', status: 'active' },
  ];

  const compareChart = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { data: [model.current.version, model.previous.version], textStyle: { color: '#9aa5b4', fontSize: 11 }, top: 0 },
    grid: { left: 80, right: 16, top: 35, bottom: 30 },
    xAxis: { type: 'value', max: 100, splitLine: { show: false }, axisLabel: { color: '#9aa5b4', fontSize: 10 } },
    yAxis: { type: 'category', data: ['Accuracy', 'Precision', 'Recall', 'F1-Score'], axisLabel: { color: '#9aa5b4', fontSize: 10 }, axisLine: { lineStyle: { color: '#2a3548' } } },
    series: [
      { name: model.current.version, type: 'bar', data: [94.2, 92.5, 91.8, 91.0], itemStyle: { color: '#22c55e' } },
      { name: model.previous.version, type: 'bar', data: [91.8, 89.2, 88.5, 88.0], itemStyle: { color: '#6b7a8d' } },
    ],
  };

  return (
    <div className="model-page">
      <div className="page-header"><h2>Quản lý Mô hình AI</h2></div>

      <div className="model-grid">
        {/* Current model */}
        <div className="card">
          <div className="card-header">Model đang hoạt động <span className="badge badge-green">ACTIVE</span></div>
          <div className="model-stats">
            <div className="stat-row"><span>Phiên bản</span><strong>{model.current.version}</strong></div>
            <div className="stat-row"><span>Loại</span><strong>{model.current.type}</strong></div>
            <div className="stat-row"><span>Framework</span><strong>{model.current.framework}</strong></div>
            <div className="stat-row"><span>Accuracy</span><strong style={{ color: 'var(--green)' }}>{model.current.accuracy}%</strong></div>
            <div className="stat-row"><span>F1-Score</span><strong>{model.current.f1Score}</strong></div>
            <div className="stat-row"><span>Cập nhật</span><strong>{formatDateTime(model.current.lastUpdated)}</strong></div>
          </div>
        </div>

        {/* Pipeline */}
        <div className="card">
          <div className="card-header">Pipeline triển khai</div>
          <div className="pipeline">
            {pipelineSteps.map((s, i) => (
              <div className={`pipeline-step ${s.status}`} key={i}>
                <div className="step-circle">{s.status === 'done' ? <CheckCircle size={14} /> : i + 1}</div>
                <span className="step-label">{s.label}</span>
                {i < pipelineSteps.length - 1 && <div className="step-line" />}
              </div>
            ))}
          </div>
        </div>

        {/* Compare */}
        <div className="card">
          <div className="card-header">So sánh hiệu năng</div>
          <ReactECharts option={compareChart} style={{ height: 220 }} />
        </div>

        {/* Prediction log */}
        <div className="card">
          <div className="card-header">Log dự đoán vs thực tế</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Thời gian</th><th>Dự đoán</th><th>Thực tế</th><th>Độ tin cậy</th><th>Khớp</th></tr>
              </thead>
              <tbody>
                {model.predictions.slice(0, 10).map(p => (
                  <tr key={p.id}>
                    <td>{formatDateTime(p.timestamp)}</td>
                    <td>{p.predicted}</td>
                    <td>{p.actual}</td>
                    <td>{(p.confidence * 100).toFixed(0)}%</td>
                    <td>{p.predicted === p.actual ?
                      <span className="badge badge-green">ĐÚNG</span> :
                      <span className="badge badge-red">SAI</span>
                    }</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
