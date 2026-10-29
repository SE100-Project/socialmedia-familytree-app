# Quy ước Thiết kế & Tích hợp API (API Conventions)

Tài liệu quy định chuẩn giao tiếp REST API giữa Backend (NestJS) và Frontend (React) theo yêu cầu **NFR-08** (Nhiệm vụ **B1-04** - phụ trách bởi BE-1).

---

## 1. Tiền tố & Định dạng chuẩn (URL Prefix & Formats)
* **Tiền tố gốc**: Tất cả các API nghiệp vụ đều bắt đầu bằng `/api/...` (đã cấu hình qua `app.setGlobalPrefix('api')`).
* **Định danh khóa chính (ID)**: Sử dụng chuỗi UUID v4 chuẩn (ví dụ: `40be3e41-4758-473e-84a8-665ccabeb24f`).
* **Thời gian (DateTime)**: Định dạng chuỗi chuẩn **ISO 8601** UTC (ví dụ: `2026-10-29T12:00:00.000Z`).
* **Swagger Documentation**: Truy cập trực tiếp tại `http://localhost:3000/api/docs`.

---

## 2. Chuẩn phản hồi Lỗi (Standard Error Response)
Tất cả các lỗi (HttpException 4xx, 5xx) đều được xử lý qua `HttpExceptionFilter` và trả về JSON đồng nhất:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Số điện thoại không hợp lệ",
  "timestamp": "2026-10-29T12:00:00.000Z",
  "path": "/api/auth/register"
}
```

* **Xử lý ở Frontend (`apps/web/src/lib/api.ts`)**:
  * Khi gọi API bị lỗi, client chỉ cần đọc trường `error.response?.data?.message` để hiển thị Toast thông báo tiếng Việt cho người dùng.

---

## 3. Chuẩn phân trang (Cursor-based Pagination)
Áp dụng cho danh sách bài viết bảng tin, nhật ký thay đổi, danh sách thành viên và cây phả hệ lớn.

### Query Parameters gửi lên:
* `cursor`: (Tùy chọn) Mã ID hoặc mốc phân trang của bản ghi cuối cùng của trang trước.
* `limit`: (Tùy chọn) Số lượng bản ghi tối đa mỗi trang (mặc định: `20`, tối đa: `100`).

### Cấu trúc JSON trả về (`PaginatedResult<T>`):
```json
{
  "items": [
    { "id": "uuid-1", "title": "..." },
    { "id": "uuid-2", "title": "..." }
  ],
  "nextCursor": "uuid-2",
  "total": 45
}
```
* Nếu `nextCursor === null`, có nghĩa là đã tải đến trang cuối cùng.

---

## 4. Hợp đồng định danh người dùng: `GET /api/auth/me`
FE-1 (Huỳnh Gia Khang) dùng endpoint này để khởi tạo App Shell và phân quyền route:

```json
{
  "id": "acc-uuid",
  "profileId": "profile-uuid-hoac-null",
  "clanId": "clan-uuid-hoac-null",
  "profileLinks": [
    { "clanId": "clan-uuid", "profileId": "profile-uuid" }
  ],
  "roles": [
    { "type": "CLAN_HEAD", "clanId": "clan-uuid", "branchId": null }
  ]
}
```
* **Người dùng mới đăng ký**: `profileId: null, clanId: null` ➔ Điều hướng sang màn hình Onboarding (Xin gia nhập UC-04 hoặc Khởi tạo họ UC-07).
* **Thành viên đã liên kết**: `profileId !== null` ➔ Mở quyền truy cập Cây phả hệ, Bảng tin, Quỹ nội bộ.
