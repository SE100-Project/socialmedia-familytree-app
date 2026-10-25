# Tài liệu Cơ sở dữ liệu — Gia phả dòng họ

**Phiên bản CSDL:** 1.2  
**Cập nhật lần cuối:** 2026-10-25  
**Liên quan:** `docs/db-review.md`, `scripts/khoi_tao_database.sql`, `db/seed_dev.sql`

---

## 1. Tổng quan

Dự án sử dụng **PostgreSQL 16** với hai schema tách biệt:

| Schema | Mục đích | Nguồn tạo |
|--------|----------|-----------|
| `public` | Schema ứng dụng — Prisma ORM quản lý | `apps/api/prisma/migrations/` |
| `gia_pha` | Schema tài liệu thiết kế đầy đủ (tiếng Việt) | `scripts/khoi_tao_database.sql` |

> **Lưu ý quan trọng:** Ứng dụng NestJS hiện chạy qua Prisma kết nối `?schema=public`. Schema `gia_pha` là tài liệu tham chiếu cho DBeaver/pgAdmin, không phải schema ứng dụng. Xem chi tiết tại `docs/db-review.md` mục B3.

---

## 2. Cấu trúc schema `gia_pha` (29 bảng)

### Nhóm bảng

| Nhóm | Bảng | Chú thích |
|------|------|-----------|
| **Dòng họ & Chi** | `dong_ho`, `chi` | Đơn vị tổ chức |
| **Thành viên** | `ho_so_thanh_vien`, `quan_he_pha_he`, `cau_hinh_rieng_tu` | Phả hệ và quyền riêng tư |
| **Tài khoản** | `tai_khoan`, `xac_thuc_totp`, `tai_khoan_ho_so`, `vai_tro_phan_quyen` | Xác thực & phân quyền |
| **Gia nhập** | `yeu_cau_gia_nhap`, `loi_moi_gia_nhap` | Luồng gia nhập dòng họ |
| **Cập nhật phả hệ** | `yeu_cau_cap_nhat_pha_he`, `quyet_dinh_duyet`, `nhat_ky_thay_doi`, `tep_dinh_kem` | Workflow duyệt thay đổi |
| **Bảng tin** | `bai_viet`, `binh_luan`, `cam_xuc` | Mạng xã hội nội bộ |
| **Sự kiện & Lịch** | `su_kien`, `thong_bao` | Lịch giỗ, thông báo |
| **Bầu cử** | `phien_chon_truong_ho`, `phieu_bau_truong_ho` | Bầu Trưởng họ |
| **Quỹ** | `quy`, `dot_dong_gop`, `yeu_cau_dong_gop`, `giao_dich_quy`, `chung_tu` | Quản lý tài chính |
| **Bảo mật** | `xac_thuc_totp`, `yeu_cau_khoi_phuc_mat_khau` | 2FA, reset mật khẩu |

### Views

| View | Mô tả |
|------|-------|
| `v_so_du_quy` | Số dư tính toán từ giao dịch, không lưu giá trị dư để tránh lệch |
| `v_tuong_tac_bai_viet` | Đếm bình luận + cảm xúc cho bảng tin |

---

## 3. Indexes

### Schema `gia_pha`

| Index | Bảng | Loại | Mục đích |
|-------|------|------|----------|
| `idx_ho_so_dong_ho` | `ho_so_thanh_vien` | B-Tree | Lọc thành viên theo dòng họ |
| `idx_ho_so_chi` | `ho_so_thanh_vien` | B-Tree | Lọc thành viên theo chi |
| `idx_ho_so_trang_thai` | `ho_so_thanh_vien` | B-Tree | Lọc theo tình trạng sống/mất |
| `idx_quan_he_tu` | `quan_he_pha_he` | B-Tree | Đệ quy cây gia phả chiều xuôi |
| `idx_quan_he_den` | `quan_he_pha_he` | B-Tree | Đệ quy cây gia phả chiều ngược |
| `idx_bai_viet_dong_ho` | `bai_viet` | B-Tree (partial, PUBLISHED) | Bảng tin dòng họ |
| `idx_tk_sdt` | `tai_khoan` | B-Tree | Đăng nhập bằng SĐT |
| `idx_tk_email` | `tai_khoan` | B-Tree | Đăng nhập bằng email |
| `idx_su_kien_ngay` | `su_kien` | B-Tree | Lịch sự kiện theo ngày |

---

## 4. Triggers

| Trigger | Bảng | Loại | Mô tả |
|---------|------|------|-------|
| `trg_*_cap_nhat_luc` | 20 bảng | BEFORE UPDATE | Tự cập nhật `cap_nhat_luc` |
| `trg_qh_chan_vong` | `quan_he_pha_he` | BEFORE INSERT/UPDATE | Chặn vòng tổ tiên (advisory lock) |
| `trg_ycgn_chuyen_trang_thai` | `yeu_cau_gia_nhap` | BEFORE UPDATE | Kiểm soát machine state yêu cầu |
| `trg_yccn_chuyen_trang_thai` | `yeu_cau_cap_nhat_pha_he` | BEFORE UPDATE | Kiểm soát machine state yêu cầu |
| `trg_ycdg_chuyen_trang_thai` | `yeu_cau_dong_gop` | BEFORE UPDATE | Chặn đổi ngược từ trạng thái kết thúc |
| `trg_qdd_nguoi_duyet` | `quyet_dinh_duyet` | BEFORE INSERT | Chặn tự duyệt (BR-12) |
| `trg_qdd_chi_them` | `quyet_dinh_duyet` | BEFORE UPDATE/DELETE | Bảo vệ bất biến |
| `trg_nhat_ky_chi_them` | `nhat_ky_thay_doi` | BEFORE UPDATE/DELETE | Bảo vệ audit log |
| `trg_ho_so_qua_doi` | `ho_so_thanh_vien` | AFTER UPDATE | Khóa TK + kết thúc vai trò khi mất |

---

## 5. Business Rules được bảo vệ ở tầng DB

| BR | Mô tả | Cơ chế |
|----|-------|--------|
| BR-01 | Thành viên của chi phải thuộc cùng dòng họ | FK composite `(id, dong_ho_id)` |
| BR-02 | Không có vòng trong cây gia phả | Trigger + Recursive CTE |
| BR-03 | Hai hồ sơ quan hệ phải cùng dòng họ | Trigger kiểm tra |
| BR-07 | Trưởng họ duy nhất tại một thời điểm | Partial unique index |
| BR-12 | Người tạo yêu cầu không được tự duyệt | Trigger `fn_chan_tu_duyet` |
| BR-14 | Trạng thái yêu cầu chỉ tiến, không lùi | Trigger machine state |
| BR-16 | Khi thành viên mất, TK bị khóa, vai trò kết thúc | Trigger `fn_xu_ly_ho_so_qua_doi` |
| BR-21 | Tệp đính kèm thuộc đúng 1 parent | `CHECK num_nonnulls(...) = 1` |

---

## 6. Cài đặt và chạy

### Khởi tạo schema (lần đầu)

```bash
# Từ Docker Compose
docker compose exec -T db psql -U root -d giapha \
  -f /docker-entrypoint-initdb.d/khoi_tao_database.sql
```

### Nạp dữ liệu mẫu (dev/staging)

```bash
docker compose exec -T db psql -U root -d giapha \
  -f /workspace/db/seed_dev.sql
```

### Chạy Prisma migration (ứng dụng)

```bash
cd apps/api
pnpm prisma migrate deploy
```

---

## 7. Dữ liệu mẫu dev

File: `db/seed_dev.sql`

| Tài khoản | Email | Mật khẩu | Vai trò |
|-----------|-------|----------|---------|
| TK-001 | truongho@giapha.vn | `Dev@123456` | Trưởng họ |
| TK-002 | truongchi@giapha.vn | `Dev@123456` | Trưởng chi |
| TK-003 | thanhvien@giapha.vn | `Dev@123456` | Thành viên |
| TK-004 | nguyenphucdung.dev@gmail.com | _(Google OAuth)_ | Thành viên |

Hash được sinh bằng `argon2id` (m=65536, t=3, p=4). Để tái sinh hash:

```bash
node scripts/gen_seed_hashes.cjs
```

---

## 8. Thay đổi từ db-review (2026-10-25)

Xem chi tiết tại `docs/db-review.md`. Tóm tắt các sửa đổi đã áp dụng:

| Mục | Thay đổi | File |
|-----|----------|------|
| B1 | Thêm trigger kiểm soát trạng thái `yeu_cau_dong_gop` | `khoi_tao_database.sql` |
| B2 | Tách seed data ra `db/seed_dev.sql` | `khoi_tao_database.sql`, `db/seed_dev.sql` |
| B4 | Bỏ extension `citext`, `pgcrypto` không dùng | `khoi_tao_database.sql` |
| B6 | Thay `FOR UPDATE` bằng `pg_advisory_xact_lock` trong trigger vòng gia phả | `khoi_tao_database.sql` |
| B7 | Thêm 9 index FK còn thiếu | `migration.sql` (schema public) |
| B8 | Tối ưu partial index hàng đợi thông báo | `migration.sql` |
| B9 | Thêm partial index sự kiện loại trừ đã huỷ | `migration.sql` |
| B10 | Tối ưu partial index bài viết PUBLISHED | `migration.sql` |
| B12 | Đổi `ON DELETE SET NULL → RESTRICT` trên `MemberProfile.branchId` | `migration.sql` |
| B13 | Trigger chống tự duyệt `ApprovalDecision` | `migration.sql` |
| B21 | CHECK constraint "exactly one parent" trên `Attachment` | `migration.sql` |
