# Blog / CMS — Đề 7 (DTC245200493 — Trương Văn Tùng)

Node.js (Express + EJS) · MySQL 8 · Nginx HTTPS · Prometheus · Grafana · Loki · Promtail — 11 container.

## Chạy trong VS Code
1. Cài **Docker Desktop**, mở thư mục này bằng VS Code (`File > Open Folder`).
2. `Ctrl+Shift+P` → **Tasks: Run Task** → chạy lần lượt: `1. Tạo SSL` → `2. Docker Up (build)` → `3. Docker Status`.
   (Hoặc dùng Terminal: `bash generate-ssl.sh` (Windows: `powershell -ExecutionPolicy Bypass -File .\generate-ssl.ps1`) rồi `docker compose up -d --build`.)
   Script sẽ dùng OpenSSL cài sẵn hoặc Docker để tạo chứng chỉ có SAN cho `localhost`.
3. Đợi ~1 phút để MySQL khởi tạo, kiểm tra `docker compose ps` đều Up/Healthy.

## Địa chỉ truy cập
| Dịch vụ | URL |
|---|---|
| **Web Blog/CMS** | https://localhost:8443 (HTTP tại http://localhost:8080 tự chuyển sang HTTPS; bỏ qua cảnh báo chứng chỉ tự ký) |
| phpMyAdmin | http://localhost:8088 (user `root` / mật khẩu trong `.env`) |
| Prometheus | http://localhost:9090/targets |
| Grafana | http://localhost:3002 (admin / `.env`) → Dashboard *Blog CMS Overview* |
| Loki (Grafana → Explore) | `{job="docker"}`, `{job="docker"} \|= "blog-app"`, `{job="docker"} \|~ "(?i)(error\|warn\|fail)"` |
| Health | https://localhost:8443/health (`/metrics` bị chặn ở Nginx, Prometheus đọc nội bộ) |

Nginx dùng cổng `8080` (HTTP) và `8443` (HTTPS) trên máy host để tránh xung đột với dịch vụ khác; bên trong Docker vẫn dùng cổng `80` và `443`.

Prometheus theo dõi metrics của ứng dụng, Nginx, MySQL, cAdvisor, Loki và Promtail. Loki bật compactor để thực thi thời gian lưu log 7 ngày.

## Chạy web không cần Docker (để sửa code nhanh)
Cần MySQL cục bộ đã chạy `mysql/init.sql`.
```bash
cd app && npm install
# tạo app/.env: DB_HOST=localhost DB_USER=blog_user DB_PASSWORD=BlogUser@2026 DB_NAME=blog_cms_db
npm run dev      # http://localhost:3000
```

## Lưu ý
- Mật khẩu `blog_user` / `exporter` trong `mysql/init.sql`, `.env`, `mysql/.my.cnf` phải khớp nhau.
- Đổi mật khẩu MySQL sau khi đã khởi tạo: `docker compose down -v` rồi up lại (xóa dữ liệu).
- `.env` và `nginx/ssl/` đã nằm trong `.gitignore`.
