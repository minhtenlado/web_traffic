// Traffic monitoring domain constants — Hàng Xanh intersection, HCMC

export const DIRECTIONS = [
  { id: "bach_dang", name: "Bạch Đằng", angle: 0, short: "BĐ" },
  { id: "dien_bien_phu", name: "Điện Biên Phủ", angle: 90, short: "ĐBP" },
  { id: "xo_viet_nghe_tinh", name: "Xô Viết Nghệ Tĩnh", angle: 180, short: "XVNT" },
  { id: "hang_xanh", name: "Hàng Xanh", angle: 270, short: "HX" },
];

export const VEHICLE_TYPES = [
  { id: "car", name: "Ô tô", color: "var(--chart-2)" },
  { id: "motorbike", name: "Xe máy", color: "var(--primary)" },
  { id: "bus", name: "Xe buýt", color: "var(--warning)" },
  { id: "truck", name: "Xe tải", color: "var(--chart-5)" },
  { id: "container", name: "Container", color: "var(--chart-3)" },
];

export const CAMERAS = [
  {
    id: "cam_01",
    name: "Camera 1",
    label: "Cầu Thị Nghè - Hàng Xanh",
    direction: "hang_xanh",
    position: { x: 50, y: 72 },
    url: "https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5d9dde1f766c880017188c98&camLocation=N%C3%BAt%20giao%20H%C3%A0ng%20Xanh%203%20(C%E1%BA%A7u%20Th%E1%BB%8B%20Ngh%C3%A8%20-%20H%C3%A0ng%20Xanh)&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8",
  },
  {
    id: "cam_02",
    name: "Camera 2",
    label: "Cầu Điện Biên Phủ - Hàng Xanh",
    direction: "dien_bien_phu",
    position: { x: 68, y: 50 },
    url: "https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5d9ddf0f766c880017188c9e&camLocation=N%C3%BAt%20giao%20H%C3%A0ng%20Xanh%206%20(C%E1%BA%A7u%20%C4%90i%E1%BB%87n%20Bi%C3%AAn%20Ph%E1%BB%A7%20-%20H%C3%A0ng%20Xanh)&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8",
  },
  {
    id: "cam_03",
    name: "Camera 3",
    label: "Đinh Bộ Lĩnh - Bạch Đằng",
    direction: "bach_dang",
    position: { x: 50, y: 28 },
    url: "https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5a8253615058170011f6eabf&camLocation=%C4%90inh%20B%E1%BB%99%20L%C4%A9nh%20-%20B%E1%BA%A1ch%20%C4%90%E1%BA%B1ng%201&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8",
  },
  {
    id: "cam_04",
    name: "Camera 4",
    label: "Điện Biên Phủ - Nguyễn Gia Trí",
    direction: "dien_bien_phu",
    position: { x: 72, y: 58 },
    url: "https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=66b1c426779f74001867415e&camLocation=%C4%90i%E1%BB%87n%20Bi%C3%AAn%20Ph%E1%BB%A7%20-%20Nguy%E1%BB%85n%20Gia%20Tr%C3%AD&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8",
  },
  {
    id: "cam_05",
    name: "Camera 5",
    label: "Viện Máy tính (XVNT)",
    direction: "xo_viet_nghe_tinh",
    position: { x: 32, y: 50 },
    isReference: true,
    url: "https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5d9ddd49766c880017188c94&camLocation=N%C3%BAt%20giao%20H%C3%A0ng%20Xanh%201%20(Vi%E1%BB%87n%20M%C3%A1y%20t%C3%ADnh)&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8",
  },
  {
    id: "cam_06",
    name: "Camera 6",
    label: "Hàng Xanh - Bạch Đằng",
    direction: "bach_dang",
    position: { x: 56, y: 22 },
    isReference: true,
    url: "https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5d9ddf49766c880017188ca0&camLocation=N%C3%BAt%20giao%20H%C3%A0ng%20Xanh%207%20(H%C3%A0ng%20Xanh%20-%20C%E1%BA%A7u%20V%C4%83n%20Th%C3%A1nh)&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8",
  },
  {
    id: "cam_07",
    name: "Camera 7",
    label: "Hàng Xanh - Cầu Văn Thánh",
    direction: "hang_xanh",
    position: { x: 50, y: 82 },
    isReference: true,
    url: "https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5d9ddec9766c880017188c9c&camLocation=N%C3%BAt%20giao%20H%C3%A0ng%20Xanh%205%20(H%C3%A0ng%20Xanh%20-%20B%E1%BA%A1ch%20%C4%90%E1%BA%B1ng)&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8",
  },
];

export const SIGNAL_PHASES = [
  {
    id: "phase_1",
    name: "Pha 1 — Trục Bạch Đằng & XVNT",
    shortName: "Pha 1 (Bạch Đằng - XVNT)",
    directions: ["bach_dang", "xo_viet_nghe_tinh"],
    leftTurnDirections: ["bach_dang"], // Đèn rẽ trái Bạch Đằng xanh
    color: "var(--primary)",
  },
  {
    id: "phase_2",
    name: "Pha 2 — Trục Điện Biên Phủ & Hàng Xanh",
    shortName: "Pha 2 (ĐBP - Hàng Xanh)",
    directions: ["dien_bien_phu", "hang_xanh"],
    leftTurnDirections: ["dien_bien_phu"], // Đèn rẽ trái ĐBP xanh
    color: "var(--chart-2)",
  },
  {
    id: "phase_3",
    name: "Pha 3 — Đèn rẽ trái ưu tiên (Left Turn)",
    shortName: "Pha 3 (Rẽ trái toàn nút)",
    directions: [],
    leftTurnDirections: ["bach_dang", "dien_bien_phu", "hang_xanh", "xo_viet_nghe_tinh"], // Tất cả các hướng được rẽ trái
    color: "var(--chart-4)",
  },
];

export const ALERT_TYPES = {
  congestion: { label: "Ùn tắc", color: "red", icon: "AlertTriangle" },
  accident: { label: "Tai nạn", color: "red", icon: "CarFront" },
  camera_error: { label: "Camera lỗi", color: "amber", icon: "CameraOff" },
  signal_error: { label: "Đèn lỗi", color: "amber", icon: "TrafficCone" },
  weather: { label: "Thời tiết", color: "cyan", icon: "CloudRain" },
};

export const USER_ROLES = {
  admin: "Admin",
  operator: "Vận hành viên",
};

export const TRAFFIC_LABELS = {
  Duong_vang: { text: "Thông thoáng", cls: "green" },
  Binh_thuong: { text: "Bình thường", cls: "green" },
  Dong_xe: { text: "Đông xe", cls: "amber" },
  Sap_ket: { text: "Sắp kẹt", cls: "amber" },
  Ket_xe: { text: "Kẹt xe", cls: "red" },
} as const;

export type TrafficLabelKey = keyof typeof TRAFFIC_LABELS;

export const LABEL_SEVERITY: Record<string, number> = {
  Duong_vang: 0,
  Binh_thuong: 1,
  Dong_xe: 2,
  Sap_ket: 3,
  Ket_xe: 4,
};

export function labelToDensity(label?: string): number {
  switch (label) {
    case "Duong_vang":
      return 15;
    case "Binh_thuong":
      return 30;
    case "Dong_xe":
      return 60;
    case "Sap_ket":
      return 78;
    case "Ket_xe":
      return 95;
    default:
      return 20;
  }
}

export function pickWorstLabel(labels: string[]): string {
  let worst = labels[0] || "Duong_vang";
  for (const l of labels) {
    if ((LABEL_SEVERITY[l] ?? 0) > (LABEL_SEVERITY[worst] ?? 0)) worst = l;
  }
  return worst;
}
