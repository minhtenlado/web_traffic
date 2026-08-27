// Vietnamese-aware formatting helpers

export function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toLocaleString("vi-VN");
}

export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatClockTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date) + " " + formatTime(date);
}

export function formatLongDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function timeAgo(date: Date | string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds} giây trước`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
