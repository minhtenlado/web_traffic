# Cấu hình Web trên Vercel

Web dùng API phía máy chủ cho đăng nhập và Firebase. Các đường dẫn tệp trên máy cá nhân không tồn tại trên Vercel.

Trong dự án `web-traffic`, vào Settings → Environment Variables và thêm hai biến loại Secret/Sensitive cho Production:

- `TRAFFIC_AUTH_JSON`: toàn bộ JSON cấu hình tài khoản, gồm `secret` ngẫu nhiên và danh sách `users` với mật khẩu đã băm scrypt.
- `FIREBASE_ADMIN_KEY_JSON`: toàn bộ JSON service account Firebase hiện dùng trên máy chủ.

Không đặt tiền tố `NEXT_PUBLIC_`, không đưa các giá trị này vào GitHub. Sau khi lưu, Redeploy để bản triển khai mới nhận biến môi trường.

Tài khoản và mật khẩu vẫn là tài khoản được cấp trong tệp `~/.config/traffic-light/access.txt` nếu sử dụng cấu hình tài khoản của máy hiện tại. Tài khoản cũ từng được lưu trong trình duyệt không còn là nguồn xác thực.

Khi chạy trên máy cá nhân, vẫn có thể dùng `TRAFFIC_AUTH_FILE` và `FIREBASE_ADMIN_KEY_PATH` như trước. Biến JSON được ưu tiên nếu có cả hai.

Kiểm tra: đăng nhập đúng trả HTTP 200 cùng cookie HttpOnly; sai mật khẩu trả 401; thiếu cấu hình đăng nhập trả 503. Sau đăng nhập, kiểm tra `/api/data?path=traffic/controllerStatus` theo danh sách đường dẫn API hỗ trợ.
