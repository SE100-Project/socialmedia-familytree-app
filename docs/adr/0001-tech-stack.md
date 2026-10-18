# ADR-0001: Lựa chọn tech stack

Trạng thái: **Đề xuất — cần cả nhóm thống nhất** (theo quy ước ra quyết định ở sheet P1_02).
Bối cảnh: 5 sinh viên, môn OOAD, web app responsive, một dòng họ ở bản đầu, ~5.000 hồ sơ, ≥ 5 thế hệ, 24/7 (NFR-03/05).

## Quyết định
| Hạng mục | Chọn | Phương án đã cân nhắc | Lý do chính |
|---|---|---|---|
| Ngôn ngữ | **TypeScript toàn stack** | Java Spring + React; C# .NET + React | Một ngôn ngữ cho cả nhóm, ai cũng đọc/sửa được code của nhau; ít thời gian cài đặt môi trường |
| Backend | **NestJS** (modular monolith) | Spring Boot, ASP.NET, Express thuần, Django | Module + DI + Controller/Service/Repository ánh xạ trực tiếp sang sơ đồ lớp/CRC; có Swagger, validation, test sẵn; Express thuần dễ thành "mỗi người một kiểu" |
| Kiến trúc | Khối đơn, phân lớp, chia module theo nhóm use case | Microservices | Quy mô và thời gian không cần; khớp DD-01 mẫu của nhóm |
| CSDL | **PostgreSQL** | MySQL, MongoDB | Phả hệ là đồ thị quan hệ; cần transaction (duyệt → cập nhật cây → quỹ, NFR-07), recursive CTE cho tổ tiên/hậu duệ, JSONB cho `before/after` audit |
| ORM | **Prisma** + SQL thô cho truy vấn cây | TypeORM, Drizzle | Migration và schema dễ đọc, kiểu an toàn; recursive CTE dùng `$queryRaw` |
| Xác thực | JWT access token + argon2; đăng nhập bằng SĐT | Session server | Frontend/backend tách rời; vai trò **nạp lại từ DB mỗi request** để khóa tài khoản có hiệu lực ngay |
| Frontend | **React + Vite**, React Router, TanStack Query | Next.js, Vue | Không cần SSR (app sau đăng nhập); build nhanh; hệ sinh thái vẽ cây tốt |
| Vẽ cây | Đề xuất **React Flow (`@xyflow/react`) + dagre/elk**; vợ/chồng cùng hàng | `family-chart`, D3 thuần | Cần spike 1–2 ngày thử với 5.000 hồ sơ trước khi chốt (NFR-03). Tải theo vùng/nhánh, không dựng cả cây |
| Việc nền | `@nestjs/schedule` (cron) + bảng `Notification` làm outbox | BullMQ + Redis | Nhắc 7 ngày/1 ngày và sinh lịch giỗ chỉ cần cron hằng ngày; tránh thêm Redis |
| Email | Nodemailer + SMTP (Mailpit khi dev) | SendGrid… | Email chỉ là kênh phụ; thông báo trong app là kênh chính (FR-31) |
| Tệp (ảnh/video/chứng từ) | Giao diện `StorageService`; dev = đĩa local, deploy = S3-compatible (R2/S3) | Lưu trong DB | Đổi nơi lưu không đổi nghiệp vụ; kiểm loại/size tệp (NFR-08) |
| Lịch âm | Thư viện âm lịch Việt Nam (chọn + kiểm thử với bộ ngày mẫu) | Tự viết | Dễ sai năm nhuận; cần bộ test đối chiếu |
| Test | Jest (api), Vitest (web), Playwright E2E cho 3–4 luồng chính (sau) | — | |
| CI/CD | GitHub Actions; deploy bản demo từ `main` | — | Khớp P4I_01 |
| Quản lý repo | **Monorepo** pnpm workspaces (`apps/api`, `apps/web`) | 2 repo | Một PR cho một use case xuyên FE+BE; 1 CI |

## Hệ quả / điểm cần chú ý
- Prisma không biểu diễn CHECK constraint → viết tay trong migration (không tự tham chiếu ở `Relationship`, số tiền > 0, v.v.).
- Số dư quỹ **không lưu cứng**: tính từ giao dịch đã hoàn tất (FR-38).
- Cần chốt sớm với khách hàng: cách khôi phục mật khẩu khi không có email (FR-51) — hiện chưa có kênh xác minh SĐT (OTP SMS tốn phí).