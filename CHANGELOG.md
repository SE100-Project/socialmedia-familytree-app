# Nhật ký thay đổi (Changelog)

Tất cả các thay đổi quan trọng của dự án Hệ thống Mạng xã hội nội bộ và Quản lý Cây gia phả dòng họ được ghi nhận tại đây.

---

## [2026-10-29] - Hoàn thiện Module Xác thực (Auth) & Hệ thống Phân quyền (Authorization)

### 1. Đồng bộ CSDL & Dữ liệu mẫu (Dev Seed)
* **CSDL**: Đồng bộ và deploy migration `20261025044238_db_review_fixes` vào PostgreSQL 16 (chạy qua Docker), định hình 29 model và 17 enum chuẩn CSDL v1.2.
* **Seed Script (`apps/api/prisma/seed.ts`)**:
  * Tự động hóa qua lệnh `pnpm prisma db seed`.
  * Khởi tạo **1 Dòng họ mẫu (Option A)**: *"Dòng họ Nguyễn Tộc Đặng Giang"* (`CLAN-NGUYEN-DG`).
  * Khởi tạo 2 Chi nhánh: *"Chi Trưởng"* và *"Chi Thứ"*.
  * Khởi tạo 4 Tài khoản mẫu với mật khẩu Argon2id `Dev@123456`:
    * Trưởng họ (`0901000001` / `truongho@giapha.vn` - `CLAN_HEAD`).
    * Trưởng chi (`0901000002` / `truongchi@giapha.vn` - `BRANCH_HEAD`).
    * Thành viên (`0901000003` / `thanhvien@giapha.vn`).
    * Kỹ thuật viên (`0901000004` / `kythuatvien@giapha.vn` - `TECH_SUPPORT`).
  * Khởi tạo Cây phả hệ đa thế hệ: 12 hồ sơ thành viên từ Đời 1 (Thủy tổ) đến Đời 4.
  * Thiết lập quan hệ Huyết thống (`PARENT_CHILD`) và quan hệ Hôn nhân Dâu/Rể (`SPOUSE`) hiển thị trực tiếp ngang hàng trên cây (Option 1).
  * Khởi tạo Quỹ Khuyến học (số dư ban đầu 15.000.000 VNĐ), bài viết ghim và cấu hình TOTP mã hóa.

### 2. Xác thực đa phương thức (Authentication)
* **Đăng ký nội bộ (UC-01)**: Bắt buộc SĐT (chuẩn hóa đầu số VN `+84/0`), email tùy chọn, băm mật khẩu Argon2id, sinh mã tài khoản duy nhất 8 ký tự.
* **Đăng nhập nội bộ (UC-02)**: Cho phép đăng nhập linh hoạt bằng cả **Số điện thoại** hoặc **Email**.
* **Đổi mật khẩu chủ động (UC-03 / FR-51)**: `POST /auth/change-password` xác minh mật khẩu cũ và cập nhật mật khẩu mới.
* **Bảo mật Google Authenticator (TOTP - CSDL v1.2 §6.2)**:
  * Xây dựng module native RFC 6238 (`apps/api/src/common/totp.ts`).
  * Mã hóa Secret Key hai chiều bằng thuật toán **AES-256-GCM** trước khi lưu vào bảng `TotpCredential`.
  * Chống tấn công phát lại (Anti-Replay Attack) bằng cơ chế kiểm soát `lastTimeStep`.
  * `POST /auth/totp/setup`: Sinh secret Base32 và URI `otpauth://` để frontend render mã QR Code.
  * `POST /auth/totp/verify-setup`: Xác thực mã OTP 6 số lần đầu để kích hoạt TOTP.
* **Quên mật khẩu & Khôi phục quyền truy cập (UC-03)**:
  * `POST /auth/forgot-password/verify-totp`: Xác minh mã OTP 6 số từ Google Authenticator ➔ Cấp `resetToken` bảo mật (hạn 15 phút) lưu trong bảng `PasswordResetRequest`.
  * `POST /auth/reset-password`: Đặt lại mật khẩu mới bằng `resetToken` trong một database transaction.
* **Đăng nhập Google Sign-In (CSDL v1.2 §6.2)**:
  * `POST /auth/google`: Xác thực claim `google_sub` (OpenID Connect).
  * Bắt buộc liên kết số điện thoại trong lần đầu đăng ký, lưu tài khoản với `authType: GOOGLE`, `passwordHash: null`.
  * Hỗ trợ mock token cho dev/test và tích hợp Google tokeninfo API cho production.

### 3. Phân quyền theo Vai trò & Phạm vi (Authorization - NFR-01 / FR-03)
* **Cập nhật `JwtAuthGuard`**: Luôn nạp lại tài khoản, danh sách `profileLinks` và các vai trò còn hiệu lực từ CSDL mỗi request.
* **Decorator `@Roles()` & `RolesGuard`**: Khai báo và chặn truy cập cấp endpoint cho các vai trò `CLAN_HEAD`, `BRANCH_HEAD`, `TECH_SUPPORT`.
* **Công cụ chính sách tập trung `PolicyService`**:
  * `isLinkedMember`: Chặn người dùng chưa duyệt gia nhập truy cập dữ liệu nội bộ (403 Forbidden).
  * `canManageBranch`: Trưởng họ quản lý mọi chi; Trưởng chi chỉ quản lý chi của mình.
  * `canManageMember`: Trưởng họ quản lý mọi hồ sơ (kể cả nút gốc Thủy tổ); Trưởng chi chỉ quản lý hồ sơ thuộc chi mình.
  * `canManageFund`: Phân quyền quỹ toàn họ vs quỹ chi.
  * `canModeratePost`: Kiểm duyệt bài viết theo phạm vi dòng họ / chi.

### 4. Kiểm thử & Môi trường
* Cấu hình file môi trường `apps/api/.env` kết nối PostgreSQL Docker port 5433 và khóa `JWT_ACCESS_SECRET`.
* Đạt 100% Passed trên toàn bộ 24 ca kiểm thử tự động (Unit test + Integration test):
  * `phone.spec.ts` (2 tests)
  * `totp.spec.ts` (5 tests)
  * `policy.service.spec.ts` (10 tests)
  * `auth.service.spec.ts` (7 tests)
* Biên dịch TypeScript `tsc --noEmit` thành công không cảnh báo.


### 4. Cơ sở hạ tầng Backend & Tiêu chuẩn API (Tasks BE-1: B1-00 -> B1-05)
* **Audit Trail tập trung (AuditService - FR-46)**:
  * Phương thức log({ actorId, action, entityType, entityId, before, after, tx }).
  * Đảm bảo nguyên tắc không bao giờ ném ngoại lệ làm gián đoạn luồng nghiệp vụ.
  * Hỗ trợ Prisma transaction client (	x) để cùng commit trong một giao dịch nguyên tử (NFR-07).
* **Bộ lọc ngoại lệ toàn cục (HttpExceptionFilter - NFR-08)**:
  * Chuẩn hóa mọi phản hồi lỗi về định dạng JSON nhất quán { statusCode, error, message, timestamp, path }.
  * Phục vụ trực tiếp cho frontend kit pi.ts.
* **Chuẩn phân trang Cursor (CursorPaginationDto & PaginatedResult<T>)**:
  * Định dạng { items, nextCursor } và tài liệu hướng dẫn quy ước tại docs/api-conventions.md.
* **Hoàn thiện hợp đồng GET /auth/me & Bảo vệ Brute-force (B1-05)**:
  * Bổ sung clanId, ccountCode, phone, email, status, profileLinks, 
oles vào response của /auth/me.
  * Giới hạn tần suất đăng nhập (Rate Limiting / Brute-force protection): Tự động chặn và trả HTTP 429 (Too Many Requests) sau 5 lần thử sai liên tiếp trong 15 phút.
  * Kiểm tra tài khoản bị khóa (status = LOCKED): Ngăn chặn đăng nhập và trả thông báo rõ ràng; đồng thời JwtAuthGuard từ chối token ngay lập tức ở request kế tiếp khi tài khoản bị khóa giữa chừng (NFR-02).
* **Quy trình & CI/CD (.github)**:
  * Thiết lập GitHub Actions CI (.github/workflows/ci.yml), CODEOWNERS phân công theo bảng trách nhiệm nhóm, và mẫu Pull Request (pull_request_template.md).
* **Hồ sơ Thiết kế OOAD (Biểu mẫu OOAD_Nhóm 7.xlsx)**:
  * Cập nhật sheet P3D_01_CRC_ThietKeLop với toàn bộ 22 lớp thực thể (CL-01 đến CL-22) từ hồ sơ phân tích phả hệ.
