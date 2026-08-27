export const DIRECTIONS = [
  { id: 'bach_dang', name: 'Bạch Đằng', angle: 0 },
  { id: 'dien_bien_phu', name: 'Điện Biên Phủ', angle: 90 },
  { id: 'xo_viet_nghe_tinh', name: 'Xô Viết Nghệ Tĩnh', angle: 180 },
  { id: 'hang_xanh', name: 'Hàng Xanh', angle: 270 },
];

export const VEHICLE_TYPES = [
  { id: 'car', name: 'Ô tô', color: '#3b82f6' },
  { id: 'motorbike', name: 'Xe máy', color: '#22c55e' },
  { id: 'bus', name: 'Xe buýt', color: '#f59e0b' },
  { id: 'truck', name: 'Xe tải', color: '#a855f7' },
  { id: 'pedestrian', name: 'Người đi bộ', color: '#06b6d4' },
];

// Hàng Xanh roundabout/overpass actual center (shifted slightly East to center on screen)
export const INTERSECTION_CENTER = [10.80150, 106.71150];

export const CAMERAS = [
  {
    // Cam 1: Vị trí vòng xoay, hướng cầu Thị Nghè vào (Old cam 4)
    id: 'cam1',
    name: 'Camera 1 – Cầu Thị Nghè - Hàng Xanh',
    direction: 'hang_xanh',
    position: [10.79979, 106.71131],
    url: 'https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5d9dde1f766c880017188c98&camLocation=Nút giao Hàng Xanh 3 (Cầu Thị Nghè - Hàng Xanh)&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8',
  },
  {
    // Cam 2: Phía nam vòng xoay, hướng cầu Điện Biên Phủ (cầu vượt) xuống (Old cam 6)
    id: 'cam2',
    name: 'Camera 2 – Cầu Điện Biên Phủ - Hàng Xanh',
    direction: 'dien_bien_phu',
    position: [10.80077, 106.70898],
    url: 'https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5d9ddf0f766c880017188c9e&camLocation=Nút giao Hàng Xanh 6 (Cầu Điện Biên Phủ - Hàng Xanh)&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8',
  },
  {
    // Cam 3: Trên đường Bạch Đằng phía bắc, gần ngã ba Đinh Bộ Lĩnh (Old cam 1)
    id: 'cam3',
    name: 'Camera 3 – Đinh Bộ Lĩnh - Bạch Đằng',
    direction: 'bach_dang',
    position: [10.80300, 106.70985],
    url: 'https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5a8253615058170011f6eabf&camLocation=Đinh Bộ Lĩnh - Bạch Đằng 1&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8',
  },
  {
    // Cam 4: Phía tây-nam, Điện Biên Phủ giao Nguyễn Gia Trí (D2 cũ) (Old cam 5)
    id: 'cam4',
    name: 'Camera 4 – Điện Biên Phủ - Nguyễn Gia Trí',
    direction: 'dien_bien_phu',
    position: [10.80102, 106.71495],
    url: 'https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=66b1c426779f74001867415e&camLocation=Điện Biên Phủ - Nguyễn Gia Trí&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8',
  },
  {
    // Cam 5: Trên đường Xô Viết Nghệ Tĩnh, phía bắc vòng xoay (gần Viện Máy tính) (Old cam 3)
    id: 'cam5',
    name: 'Camera 5 – Viện Máy tính',
    direction: 'xo_viet_nghe_tinh',
    position: [10.80175, 106.71120],
    url: 'https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5d9ddd49766c880017188c94&camLocation=Nút giao Hàng Xanh 1 (Viện Máy tính)&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8',
  },
  {
    // Cam 6: Nút giao phía đông-bắc, Hàng Xanh gặp Bạch Đằng (Old cam 2)
    id: 'cam6',
    name: 'Camera 6 – Hàng Xanh - Bạch Đằng',
    direction: 'bach_dang',
    position: [10.80207, 106.71166],
    url: 'https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5d9ddec9766c880017188c9c&camLocation=Nút giao Hàng Xanh 5 (Hàng Xanh - Bạch Đằng)&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8',
  },
  {
    // Cam 7: Phía đông, hướng cầu Văn Thánh (Old cam 7)
    id: 'cam7',
    name: 'Camera 7 – Hàng Xanh - Cầu Văn Thánh',
    direction: 'hang_xanh',
    position: [10.80137, 106.71210],
    url: 'https://giaothong.hochiminhcity.gov.vn/expandcameraplayer/?camId=5d9ddf49766c880017188ca0&camLocation=Nút giao Hàng Xanh 7 (Hàng Xanh - Cầu Văn Thánh)&camMode=camera&videoUrl=https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8',
  },
];

export const SIGNAL_PHASES = [
  { id: 'phase_1', name: 'Pha 1 – Trục Bạch Đằng & XVNT', directions: ['bach_dang', 'xo_viet_nghe_tinh'] },
  { id: 'phase_2', name: 'Pha 2 – Trục Điện Biên Phủ', directions: ['dien_bien_phu', 'hang_xanh'] },
];

export const ALERT_TYPES = {
  congestion: { label: 'Ùn tắc', color: 'red' },
  accident: { label: 'Tai nạn', color: 'red' },
  camera_error: { label: 'Camera lỗi', color: 'amber' },
  signal_error: { label: 'Đèn lỗi', color: 'amber' },
};

export const USER_ROLES = {
  admin: 'Admin',
  operator: 'Vận hành viên',
};
