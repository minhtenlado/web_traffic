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
    aiInput: true,
    position: { x: 50, y: 72 },
    realPosition: [10.79979, 106.71131],
    url: "https://giaothong.hochiminhcity.gov.vn/render/ImageHandler.ashx?id=5d9dde1f766c880017188c98",
  },
  {
    id: "cam_02",
    name: "Camera 2",
    label: "Cầu Điện Biên Phủ - Hàng Xanh",
    direction: "dien_bien_phu",
    aiInput: true,
    position: { x: 68, y: 50 },
    realPosition: [10.80077, 106.70898],
    url: "https://giaothong.hochiminhcity.gov.vn/render/ImageHandler.ashx?id=5d9ddf0f766c880017188c9e",
  },
  {
    id: "cam_03",
    name: "Camera 3",
    label: "Đinh Bộ Lĩnh - Bạch Đằng",
    direction: "bach_dang",
    aiInput: true,
    position: { x: 50, y: 28 },
    realPosition: [10.80300, 106.70985],
    url: "https://giaothong.hochiminhcity.gov.vn/render/ImageHandler.ashx?id=5a8253615058170011f6eabf",
  },
  {
    id: "cam_04",
    name: "Camera 4",
    label: "Điện Biên Phủ - Nguyễn Gia Trí",
    direction: "dien_bien_phu",
    aiInput: true,
    position: { x: 72, y: 58 },
    realPosition: [10.80102, 106.71495],
    url: "https://giaothong.hochiminhcity.gov.vn/render/ImageHandler.ashx?id=66b1c426779f74001867415e",
  },
  {
    id: "cam_05",
    name: "Camera 5",
    label: "Viện Máy tính (XVNT)",
    direction: "xo_viet_nghe_tinh",
    aiInput: true,
    position: { x: 32, y: 50 },
    realPosition: [10.80175, 106.71120],
    url: "https://giaothong.hochiminhcity.gov.vn/render/ImageHandler.ashx?id=5d9ddd49766c880017188c94",
  },
  {
    id: "cam_06",
    name: "Camera 6",
    label: "Hàng Xanh - Bạch Đằng",
    direction: "bach_dang",
    aiInput: false,
    position: { x: 56, y: 22 },
    realPosition: [10.80207, 106.71166],
    isReference: true,
    url: "https://giaothong.hochiminhcity.gov.vn/render/ImageHandler.ashx?id=5d9ddf49766c880017188ca0",
  },
  {
    id: "cam_07",
    name: "Camera 7",
    label: "Hàng Xanh - Cầu Văn Thánh",
    direction: "hang_xanh",
    aiInput: false,
    position: { x: 50, y: 82 },
    realPosition: [10.80137, 106.71210],
    isReference: true,
    url: "https://giaothong.hochiminhcity.gov.vn/render/ImageHandler.ashx?id=5d9ddec9766c880017188c9c",
  },
];

// The web display axes are mirrored to match the physical model. Keep STM32 phase IDs
// unchanged: only the web-facing road labels and light groups are remapped here.
export const SIGNAL_PHASES: { id: string; name: string; shortName: string; directions: string[]; leftTurnDirections: string[]; color: string }[] = [
  {
    "id": "boot_allred",
    "name": "Toàn đỏ khởi động",
    "shortName": "Toàn đỏ khởi động",
    "directions": [],
    "leftTurnDirections": [],
    "color": "var(--primary)"
  },
  {
    "id": "ns_green",
    "name": "Đông–Tây: xanh thẳng",
    "shortName": "Đông–Tây: xanh thẳng",
    "directions": [
      "dien_bien_phu",
      "hang_xanh"
    ],
    "leftTurnDirections": [],
    "color": "var(--primary)"
  },
  {
    "id": "ns_yellow",
    "name": "Đông–Tây: vàng",
    "shortName": "Đông–Tây: vàng",
    "directions": [
      "dien_bien_phu",
      "hang_xanh"
    ],
    "leftTurnDirections": [],
    "color": "var(--primary)"
  },
  {
    "id": "after_ns_allred",
    "name": "Toàn đỏ sau Đông–Tây",
    "shortName": "Toàn đỏ sau Đông–Tây",
    "directions": [],
    "leftTurnDirections": [],
    "color": "var(--primary)"
  },
  {
    "id": "ns_left",
    "name": "Đông–Tây: xanh rẽ trái",
    "shortName": "Đông–Tây: xanh rẽ trái",
    "directions": [],
    "leftTurnDirections": [
      "dien_bien_phu",
      "hang_xanh"
    ],
    "color": "var(--primary)"
  },
  {
    "id": "after_ns_left_allred",
    "name": "Toàn đỏ sau rẽ Đông–Tây",
    "shortName": "Toàn đỏ sau rẽ Đông–Tây",
    "directions": [],
    "leftTurnDirections": [],
    "color": "var(--primary)"
  },
  {
    "id": "ew_green",
    "name": "Bắc–Nam: xanh thẳng",
    "shortName": "Bắc–Nam: xanh thẳng",
    "directions": [
      "bach_dang",
      "xo_viet_nghe_tinh"
    ],
    "leftTurnDirections": [],
    "color": "var(--primary)"
  },
  {
    "id": "ew_yellow",
    "name": "Bắc–Nam: vàng",
    "shortName": "Bắc–Nam: vàng",
    "directions": [
      "bach_dang",
      "xo_viet_nghe_tinh"
    ],
    "leftTurnDirections": [],
    "color": "var(--primary)"
  },
  {
    "id": "after_ew_allred",
    "name": "Toàn đỏ sau Bắc–Nam",
    "shortName": "Toàn đỏ sau Bắc–Nam",
    "directions": [],
    "leftTurnDirections": [],
    "color": "var(--primary)"
  },
  {
    "id": "ew_left",
    "name": "Bắc–Nam: xanh rẽ trái",
    "shortName": "Bắc–Nam: xanh rẽ trái",
    "directions": [],
    "leftTurnDirections": [
      "bach_dang",
      "xo_viet_nghe_tinh"
    ],
    "color": "var(--primary)"
  },
  {
    "id": "after_ew_left_allred",
    "name": "Toàn đỏ sau rẽ Bắc–Nam",
    "shortName": "Toàn đỏ sau rẽ Bắc–Nam",
    "directions": [],
    "leftTurnDirections": [],
    "color": "var(--primary)"
  }
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

export const EDGE_TRAFFIC_LABELS: Record<string, { text: string; displayCode: string; cls: "green" | "amber" | "red" }> = {
  Khong_ket: { text: "Thông thoáng", displayCode: "Thong_thoang", cls: "green" },
  Dong: { text: "Trung bình", displayCode: "Trung_binh", cls: "green" },
  Ket_nhe: { text: "Đông đúc", displayCode: "Dong_duc", cls: "amber" },
  Ket_nang: { text: "Rất đông", displayCode: "Rat_dong", cls: "red" },
};

// Historic five-bin records keep their original keys; only the presentation is shared.
export const TRAFFIC_LABELS = {
  Duong_vang: EDGE_TRAFFIC_LABELS.Khong_ket,
  Binh_thuong: EDGE_TRAFFIC_LABELS.Khong_ket,
  Dong_xe: EDGE_TRAFFIC_LABELS.Dong,
  Sap_ket: EDGE_TRAFFIC_LABELS.Ket_nhe,
  Ket_xe: EDGE_TRAFFIC_LABELS.Ket_nang,
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

export const AREA_CONFIGS: Record<string, { name: string; center: [number, number]; zoom: number }> = {
  "hang-xanh": { name: "Ngã tư Hàng Xanh", center: [10.8015, 106.7115], zoom: 18 },
  "truong-chinh": { name: "Đường Trường Chinh", center: [10.8300, 106.6550], zoom: 16 },
  "cong-hoa": { name: "Đường Cộng Hòa", center: [10.8000, 106.6500], zoom: 16 },
  "xa-lo-ha-noi": { name: "Xa lộ Hà Nội", center: [10.8550, 106.7700], zoom: 16 },
};
