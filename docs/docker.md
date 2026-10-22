# Chạy project bằng Docker Compose

Compose chạy toàn bộ môi trường phát triển: PostgreSQL, Mailpit, API NestJS và Web Vite. Source code được mount vào container để API/Web tự reload khi chỉnh sửa.

## Khởi động trên Windows

Cài và mở Docker Desktop, sau đó mở PowerShell tại thư mục gốc project:

```powershell
Copy-Item .env.docker.example .env.docker
notepad .env.docker
```

File mẫu dùng credential dành cho máy cá nhân. Đổi `POSTGRES_PASSWORD` và `JWT_ACCESS_SECRET` nếu dùng trên máy dùng chung. Không commit `.env.docker`.

Khởi động các container:

```powershell
docker compose --env-file .env.docker config
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

Hoặc sau khi đã tạo `.env.docker`, chạy `pnpm docker:up`; dừng bằng `pnpm docker:down`. Nếu chỉ muốn bật PostgreSQL và Mailpit để chạy API/Web trực tiếp trên máy, dùng `pnpm db:up`.

Lần đầu Docker cần tải image và cài package, nên thời gian chạy sẽ lâu hơn. Xem log nếu một service chưa sẵn sàng:

```powershell
docker compose --env-file .env.docker logs -f api web db
```

Compose đợi PostgreSQL healthy, sau đó API đồng bộ schema từ `apps/api/prisma/schema.prisma` bằng `prisma migrate deploy` rồi khởi động NestJS. Web chỉ khởi động sau khi API trả trạng thái healthy.

## Truy cập ứng dụng

- Web: [http://localhost:5173](http://localhost:5173)
- API: [http://localhost:3000/api](http://localhost:3000/api)
- Swagger: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- Kiểm tra API và database: [http://localhost:3000/api/health](http://localhost:3000/api/health)
- Hộp thư thử nghiệm Mailpit: [http://localhost:8025](http://localhost:8025)
- SMTP: `localhost:1025`
- PostgreSQL: `localhost:5432`, database/user/password theo `.env.docker`

Các port chỉ bind vào `127.0.0.1`. Nếu port đang bận, đổi `DB_PORT`, `SMTP_PORT`, `MAILPIT_UI_PORT`, `API_PORT` hoặc `WEB_PORT` trong `.env.docker`, rồi chạy lại Compose.

## Các lệnh thường dùng

```powershell
# Trạng thái
docker compose --env-file .env.docker ps

# Theo dõi log
docker compose --env-file .env.docker logs -f api

# Mở psql bên trong container PostgreSQL
docker compose --env-file .env.docker exec db psql -U giapha -d giapha

# Dừng các container, giữ dữ liệu database
docker compose --env-file .env.docker down
```

PostgreSQL lưu dữ liệu trong volume `pgdata`; lệnh `down` giữ nguyên volume. Chỉ thêm `-v` khi muốn xóa database phát triển và tạo lại từ đầu:

```powershell
docker compose --env-file .env.docker down -v
```

## Ghi chú về migration

Project đã thiết lập thư mục migration Prisma tại `apps/api/prisma/migrations`. Cấu hình khởi động API sử dụng `prisma migrate deploy` để tự động cập nhật schema và các ràng buộc bảo mật (Google OIDC, TOTP, case-insensitive email). Khi có thay đổi schema mới, hãy tạo migration bằng `pnpm --filter api exec prisma migrate dev --name <ten_migration>`.
