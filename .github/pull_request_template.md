## Mô tả Pull Request
<!-- Tóm tắt ngắn gọn tính năng hoặc lỗi được xử lý -->

## Use Case / Mã phân công liên quan
- **Mã việc**: (ví dụ: B1-02, B2-01...)
- **Use Case**: (ví dụ: UC-01, UC-07...)

## Checklist kiểm tra trước khi tạo PR
- [ ] Code tuân thủ kiến trúc phân lớp và quy ước API trong `docs/api-conventions.md`.
- [ ] Đã chạy `pnpm typecheck` thành công không có lỗi kiểu.
- [ ] Đã viết unit test / integration test và `pnpm test` đều xanh.
- [ ] Nếu có thay đổi `schema.prisma`, đã tạo migration và cập nhật script seed.
- [ ] Người review khác người tạo PR.
