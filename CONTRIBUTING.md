# Quy ước làm việc

## Nhánh (theo sheet P4I_01_TrienKhai)
- `main`: luôn chạy được, là bản demo/nộp. Chỉ merge từ `develop` khi cuối mốc.
- `develop`: nhánh tích hợp. **Không push trực tiếp**, chỉ merge qua Pull Request.
- `feature/<UC-xx>-<mo-ta-ngan>`, ví dụ `feature/uc05-duyet-gia-nhap`. Một nhánh = một use case (hoặc một phần rõ ràng).
- Sửa lỗi: `fix/<mo-ta>`.

Bật branch protection cho `main` và `develop`: bắt buộc PR, ≥ 1 approve, CI xanh, không force-push.

## Commit — Conventional Commits
`feat(auth): đăng ký tài khoản bằng SĐT (UC-01)` · `fix(funds): ...` · `docs: ...` · `test: ...` · `chore: ...`
Scope = tên module (auth, genealogy, tree, feed, events, funds, reports, audit, web).

## Pull Request
- Nhỏ (lý tưởng < 400 dòng), gắn mã UC/FR, điền template.
- Người review **khác** người viết (BR-12 áp dụng cho cả nhóm: tự viết tự duyệt thì không).
- Squash merge vào `develop`.

## Definition of Done cho một use case
1. Đúng luồng chính + luồng ngoại lệ trong tài liệu use case.
2. API có kiểm tra **quyền + phạm vi chi** (NFR-01) và validate đầu vào (NFR-08).
3. Thay đổi phả hệ / vai trò / quỹ / xử lý nội dung có ghi `AuditLog` (FR-46).
4. Có test (ưu tiên: phân quyền, duyệt trùng/đồng thời NFR-07, số dư quỹ).
5. Có trong Swagger; UI dùng được ở rộng 360 / 768 / 1366 px (NFR-04).
6. CI xanh, đã được review.

## Quy tắc kỹ thuật cần giữ
- Controller mỏng → **Service** chứa nghiệp vụ → truy cập DB qua Prisma trong Service/Repository. Không viết nghiệp vụ trong controller.
- Thao tác nhiều bước (duyệt yêu cầu → cập nhật cây → audit → thông báo) phải nằm trong **một transaction** (`prisma.$transaction`).
- Không xóa cứng hồ sơ trên cây và giao dịch quỹ: xóa mềm / giao dịch đảo.
- Không commit `.env`, không log mật khẩu/token/SĐT đầy đủ. Không thu thập CCCD.
- Đổi `schema.prisma` ⇒ tạo migration mới, **không sửa migration đã merge**; PR đổi schema cần 2 người review.
