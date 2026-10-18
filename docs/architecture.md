# Kiến trúc & phân công

## Phân lớp (khớp DD-01, DD-06 của nhóm)
```
Web (React)  ──REST/JSON──▶  Controller  ▶  Service (nghiệp vụ, phân quyền theo phạm vi)  ▶  Prisma/Repository  ▶  PostgreSQL
                                   │                       └─▶ AuditService (FR-46)  └─▶ NotificationService (FR-48)
                          Scheduler (cron): giỗ tự động, nhắc sự kiện, gửi email outbox
```

## Ánh xạ use case → module (`apps/api/src/<module>`)
| Module | Use case | Trạng thái |
|---|---|---|
| `auth` | UC-01, 02 (đã có khung); UC-03, 41 | khung |
| `join` (yêu cầu/lời mời gia nhập, liên kết hồ sơ) | UC-04, 05, 06 | chưa |
| `genealogy` (dòng họ, chi, hồ sơ, quan hệ, yêu cầu cập nhật, qua đời, chuyển quyền) | UC-07–15 | chưa |
| `tree` (đọc cây, tra cứu, chi tiết hồ sơ; CTE) | UC-16, 17, 18, 37 | chưa |
| `feed` (bài, bình luận, cảm xúc, ghim, kiểm duyệt) | UC-19–24, 38 | chưa |
| `events` + `notifications` | UC-25, 26, 27 (+ UC-15 sinh giỗ) | chưa |
| `funds` | UC-28–33 | chưa |
| `reports` | UC-34, 35, 36 | chưa |
| `audit` + `support` | UC-39, 40 | chưa |

Thứ tự gợi ý (theo mức ưu tiên "Bắt buộc" ở P2_05): **auth → genealogy + join + tree + audit → feed + events/notifications → funds + reports**.
Lát cắt dọc đầu tiên nên là *UC-07 Khởi tạo phả hệ → UC-08 → UC-10 → UC-16 xem cây*: chạm đủ DB, phân quyền, audit và UI cây, giúp lộ rủi ro sớm.

## Phân công gợi ý cho 5 người (chia theo module dọc, mỗi người làm cả BE+FE)
| TV | Phụ trách | Use case |
|---|---|---|
| 1 | Danh tính, phân quyền, gia nhập, audit nền | UC-01–06, 09, 40, 41 |
| 2 | Phả hệ — ghi (tạo/sửa/duyệt/qua đời) | UC-07, 08, 10–15 |
| 3 | Phả hệ — đọc & UI cây, báo cáo nhân khẩu, layout/UI kit chung | UC-16–18, 36, 37 |
| 4 | Bảng tin, sự kiện, thông báo, lịch âm | UC-19–27, 38 |
| 5 | Quỹ, báo cáo tài chính, hỗ trợ kỹ thuật | UC-28–35, 39 |
Đây chỉ là đề xuất — nhóm tự chốt theo thế mạnh. Điền `CODEOWNERS` sau khi chốt.

## Nguyên tắc phân quyền (NFR-01) — nơi dễ sai nhất
- Quyền = `RoleAssignment` (loại + phạm vi chi/họ), không suy từ quan hệ huyết thống.
- Mỗi Service nhận `AuthUser` và kiểm `phạm vi` của **đối tượng bị tác động** (chi của hồ sơ/bài/quỹ), không chỉ kiểm vai trò.
- Nên tập trung vào một `PolicyService` (ví dụ `canManageBranch(user, branchId)`) để tránh mỗi nơi tự viết một kiểu, và viết test bảng cho nó trước.
- Chưa duyệt gia nhập ⇒ không có `MemberProfile` ⇒ mọi API dữ liệu nội bộ trả 403.
- Duyệt: người duyệt ≠ người tạo; duyệt trùng đồng thời chỉ tạo 1 kết quả (update có điều kiện `status = PENDING` trong transaction).
