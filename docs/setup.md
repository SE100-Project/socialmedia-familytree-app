# Hướng dẫn cài đặt và chạy dự án

**Dự án:** Mạng xã hội Cây gia phả — Nhóm 7  
**Yêu cầu:** Git, Docker Desktop (đang chạy), pgAdmin 4 (tùy chọn)

---

## 1. Clone repo

```cmd
git clone <repo-url>
cd socialmedia-familytree-app
```

---

## 2. Tạo file cấu hình môi trường

```cmd
copy .env.docker.example .env.docker
```

Mở `.env.docker` và kiểm tra:

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=root
POSTGRES_DB=socialmedia_familytree_db
DB_PORT=5432
```

> **Nếu máy đã cài PostgreSQL local** thì port 5432 sẽ bị chiếm.  
> Đổi `DB_PORT=5433` (hoặc `5434`) để tránh xung đột.

---

## 3. Khởi động database

```cmd
docker compose --env-file .env.docker up -d db
```

Kiểm tra container đang chạy:

```cmd
docker compose --env-file .env.docker ps
```

Kết quả mong đợi: cột `Status` hiển thị `healthy`.

---

## 4. Tạo schema và nạp dữ liệu mẫu

Chạy lần lượt hai lệnh sau (dùng **Command Prompt**, không phải PowerShell):

```cmd
type scripts\khoi_tao_database.sql | docker compose --env-file .env.docker exec -T db psql -U postgres -d socialmedia_familytree_db
```

```cmd
type db\seed_dev.sql | docker compose --env-file .env.docker exec -T db psql -U postgres -d socialmedia_familytree_db
```

Sau khi chạy xong sẽ có schema `gia_pha` với 29 bảng và dữ liệu mẫu 3 thế hệ.

---

## 5. Kết nối pgAdmin (tùy chọn)

Mở pgAdmin → right-click **Servers** → **Register** → **Server**:

| Trường | Giá trị |
|--------|---------|
| Name | `Gia pha Dev` |
| Host | `localhost` |
| Port | Theo `DB_PORT` trong `.env.docker` |
| Database | `socialmedia_familytree_db` |
| Username | `postgres` |
| Password | `root` |

Sau khi kết nối, vào:  
`Databases → socialmedia_familytree_db → Schemas → gia_pha → Tables`

---

## 6. Tài khoản dev

| Email | Mật khẩu | Vai trò |
|-------|----------|---------|
| truongho@giapha.vn | `Dev@123456` | Trưởng họ |
| truongchi@giapha.vn | `Dev@123456` | Trưởng chi |
| thanhvien@giapha.vn | `Dev@123456` | Thành viên |
| nguyenphucdung.dev@gmail.com | _(Google OAuth)_ | Thành viên |

---

## 7. Các lệnh thường dùng

```cmd
:: Xem trạng thái container
docker compose --env-file .env.docker ps

:: Xem log database
docker compose --env-file .env.docker logs -f db

:: Mở psql trực tiếp trong container
docker compose --env-file .env.docker exec db psql -U postgres -d socialmedia_familytree_db

:: Dừng container, GIỮ dữ liệu
docker compose --env-file .env.docker down

:: Dừng container và XÓA SẠCH dữ liệu (tạo lại từ đầu)
docker compose --env-file .env.docker down -v
```

---

## 8. Chạy toàn bộ ứng dụng

Cách này khởi động cùng lúc: PostgreSQL, Mailpit, API NestJS và Web Vite.

```cmd
docker compose --env-file .env.docker up -d --build
```

Lần đầu sẽ lâu hơn vì Docker cần build image và cài dependencies. Theo dõi tiến trình:

```cmd
docker compose --env-file .env.docker logs -f api
```

Khi log API hiện `Application is running on: http://[::1]:3000` là sẵn sàng.

**Truy cập:**

| Dịch vụ | URL |
|---------|-----|
| Web | http://localhost:5173 |
| API | http://localhost:3000/api |
| Swagger (thử API) | http://localhost:3000/api/docs |
| Health check | http://localhost:3000/api/health |
| Mailpit (hộp thư test) | http://localhost:8025 |

> Prisma migration tự động chạy khi container `api` khởi động — không cần chạy thủ công.

> Schema `gia_pha` (pgAdmin) và schema `public` (ứng dụng) độc lập nhau. Chạy app không ảnh hưởng đến schema `gia_pha` đã tạo ở bước 4.

---

## 9. Khi có thay đổi schema từ teammate

Sau khi `git pull`, nếu có file migration mới trong `apps/api/prisma/migrations/` hoặc thay đổi `scripts/khoi_tao_database.sql`:

**Schema `public` (Prisma — ứng dụng):** tự động apply khi khởi động container `api`.

**Schema `gia_pha` (tài liệu — pgAdmin):** chạy lại thủ công:

```cmd
docker compose --env-file .env.docker down -v
docker compose --env-file .env.docker up -d db

type scripts\khoi_tao_database.sql | docker compose --env-file .env.docker exec -T db psql -U postgres -d socialmedia_familytree_db
type db\seed_dev.sql | docker compose --env-file .env.docker exec -T db psql -U postgres -d socialmedia_familytree_db
```

---

## 9. Xử lý lỗi thường gặp

**Port bị chiếm:**
```
Error: bind: An attempt was made to access a socket in a way forbidden
```
→ Đổi `DB_PORT` trong `.env.docker` sang `5433` hoặc `5434`.

**Không tìm thấy `.env.docker`:**
```
couldn't find env file: .env.docker
```
→ Chạy lại bước 2.

**Thấy ít hơn 29 bảng trong pgAdmin:**  
→ Lệnh `type` ở bước 4 chưa chạy hoặc bị lỗi giữa chừng. Chạy lại từ đầu bước 4 (không cần `down -v` nếu schema chưa có gì).
