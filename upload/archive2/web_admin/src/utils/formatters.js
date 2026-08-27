export function formatNumber(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}

export function formatTime(date) {
  return new Date(date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDate(date) {
  return new Date(date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(date) {
  return formatDate(date) + ' ' + formatTime(date);
}

export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds} giây trước`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
