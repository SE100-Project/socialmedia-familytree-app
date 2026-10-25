# Báo cáo Rà soát CSDL — Gia phả dòng họ v1.2

**Ngày rà soát:** 2026-10-25  
**Phiên bản SQL nguồn:** `scripts/khoi_tao_database.sql` (schema `gia_pha`, 29 bảng, 28 enum, 2 view, 27 trigger)  
**Phiên bản tài liệu này:** 1.0 (Giai đoạn 1 — chỉ đọc)  
**Skill áp dụng:** `postgresql-code-review` (ký hiệu **PG**), `supabase-postgres-best-practices` phần PostgreSQL chung (ký hiệu **SP**, bỏ qua mọi khuyến nghị Supabase-specific)

---

## Tóm tắt

| Mức độ | Số phát hiện |
|--------|-------------|
| Cao    | 6 |
| Trung bình | 9 |
| Thấp   | 8 |
| **Tổng** | **23** |

---

## A. So sánh `schema.prisma` ↔ `scripts/khoi_tao_database.sql`

Hai nguồn này là **hai hệ thống tách rời hoàn toàn**: Prisma migration tạo schema `public` với tên tiếng Anh (PascalCase), còn file SQL tạo schema `gia_pha` với tên tiếng Việt (snake_case). Ứng dụng NestJS hiện chạy bằng Prisma migration (`?schema=public` trong `docker-compose.yml`). File `scripts/khoi_tao_database.sql` là tài liệu tham chiếu độc lập (dùng cho DBeaver/pgAdmin), không phải nguồn triển khai.

Các lệch lạc cụ thể giữa hai nguồn:

| # | Thực thể / Cột | Trong SQL (`gia_pha`) | Trong Prisma (`public`) | Ghi chú |
|---|---------------|----------------------|------------------------|---------|
| 1 | `yeu_cau_dong_gop` / `trang_thai` | enum 3 giá trị: `CHO_DUYET`, `DA_XAC_NHAN`, `BI_TU_CHOI` | `RequestStatus` 4 giá trị: `PENDING`,`APPROVED`,`REJECTED`,`CANCELLED` | SQL dùng enum riêng `trang_thai_dong_gop`; Prisma tái dùng `RequestStatus` thiếu logic kết thúc |
| 2 | `quyet_dinh_duyet` | Chỉ có `yeu_cau_gia_nhap_id` và `yeu_cau_cap_nhat_id` | `ApprovalDecision` có thêm `contributionRequestId` | Prisma mở rộng thêm cột cho yêu cầu đóng góp nhưng SQL không có |
| 3 | `tep_dinh_kem` | Có FK `yeu_cau_gia_nhap_id` | `Attachment` không có FK tới `JoinRequest` | Lệch thiếu một FK |
| 4 | `RoleAssignment.validFrom` | `DATE` | `TIMESTAMP(3)` | Kiểu khác nhau |
| 5 | `RoleAssignment.clanId` | Nullable (`REFERENCES ... ON DELETE RESTRICT`) | NOT NULL | Logic ràng buộc khác nhau — SQL cho phép NULL khi `pham_vi=CHI`; Prisma bắt buộc |
| 6 | `vai_tro_phan_quyen` | có `pham_vi_vai_tro` enum và partial unique index chống 2 Trưởng họ | `RoleAssignment` không có partial index tương đương | Prisma thiếu ràng buộc nghiệp vụ quan trọng |
| 7 | `MemberProfile` | Không có cột `accountId` trực tiếp (dùng bảng liên kết `tai_khoan_ho_so`) | Có `accountId` trực tiếp | Thiết kế khác nhau — SQL dùng bảng liên kết để hỗ trợ đa dòng họ |
| 8 | `thong_bao` | Có `trang_thai_gui`, `so_lan_thu`, `lan_thu_tiep_theo` (retry queue) | `Notification` không có các cột này | Prisma thiếu hệ thống retry queue |
| 9 | `cam_xuc.loai` | `VARCHAR(30)` tự do | `kind TEXT DEFAULT 'like'` | Giống nhau về chức năng |
| 10 | `ContributionRequest` (Prisma) | — | có `requesterId` trực tiếp | SQL dùng `tai_khoan_id` — giống về ý nghĩa |

**Kết luận:** Hai nguồn là hai artifact tách rời. Ứng dụng chạy Prisma; file SQL là tài liệu thiết kế đầy đủ hơn. Giai đoạn 2 sẽ không đồng bộ ngược hai nguồn trừ khi được yêu cầu.

---

## B. Phát hiện chi tiết

### B1. Trigger thiếu cho `yeu_cau_dong_gop` — **CAO**

**Skill:** PG  
**Vị trí:** `scripts/khoi_tao_database.sql` dòng ~424–432  
**Mức độ:** Cao  

**Vấn đề:** Bảng `yeu_cau_dong_gop` có enum `trang_thai_dong_gop` gồm `CHO_DUYET → DA_XAC_NHAN / BI_TU_CHOI`. Hai bảng yêu cầu khác (`yeu_cau_gia_nhap`, `yeu_cau_cap_nhat_pha_he`) đều được bảo vệ bởi trigger `fn_kiem_tra_chuyen_trang_thai_yc`. Bảng này **không có trigger tương đương**, nên một yêu cầu đã `DA_XAC_NHAN` hoặc `BI_TU_CHOI` vẫn có thể bị đổi ngược về `CHO_DUYET` bằng một câu UPDATE đơn giản.

**Khác biệt:** `yeu_cau_dong_gop` chỉ có 3 trạng thái (không có `CHO_BO_SUNG`), nên **không thể dùng lại** `fn_kiem_tra_chuyen_trang_thai_yc` — hàm đó cho phép chuyển `CHO_BO_SUNG → CHO_DUYET` vốn không có trong bảng đóng góp.

**Đề xuất sửa:**
```sql
CREATE OR REPLACE FUNCTION fn_kiem_tra_trang_thai_dong_gop()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.trang_thai = OLD.trang_thai THEN RETURN NEW; END IF;
  -- CHO_DUYET -> DA_XAC_NHAN hoặc BI_TU_CHOI: hợp lệ
  IF OLD.trang_thai = 'CHO_DUYET'
     AND NEW.trang_thai IN ('DA_XAC_NHAN', 'BI_TU_CHOI') THEN
    RETURN NEW;
  END IF;
  -- DA_XAC_NHAN và BI_TU_CHOI là trạng thái kết thúc, không được thay đổi
  RAISE EXCEPTION 'Chuyen trang thai dong gop khong hop le: % -> %',
    OLD.trang_thai, NEW.trang_thai;
END $$;

CREATE TRIGGER trg_ycdg_chuyen_trang_thai
  BEFORE UPDATE OF trang_thai ON yeu_cau_dong_gop
  FOR EACH ROW EXECUTE FUNCTION fn_kiem_tra_trang_thai_dong_gop();
```

**Rủi ro khi sửa:** Thấp. Trigger chỉ chặn transition không hợp lệ, không ảnh hưởng dữ liệu hiện có ở trạng thái hợp lệ.

---

### B2. Seed data lẫn trong file schema — **CAO**

**Skill:** PG  
**Vị trí:** `scripts/khoi_tao_database.sql` dòng 561–790  
**Mức độ:** Cao  

**Vấn đề:** File schema (DDL, trigger, view) và dữ liệu mẫu nằm trong cùng một transaction `BEGIN...COMMIT`. Điều này:
1. Ngăn chạy lại schema trên môi trường có dữ liệu thật (các `INSERT ... ON CONFLICT DO NOTHING` ổn nhưng `setval` sẽ reset sequence xuống 1 nếu bảng rỗng sau một lần rollback).
2. Khó kiểm soát môi trường: dev/staging/prod không thể có seed khác nhau.
3. Seed không có cách xóa + tạo lại sạch (idempotent reset).

**Hash argon2 giả:** Ba tài khoản TK-001, TK-002, TK-003 dùng cùng một chuỗi:
```
$argon2id$v=19$m=65536,t=3,p=4$qN8kE6/1Q5qX0W1v0G2J5Q$R5N5M2mYjPqL7P8b1N3rYQ
```
Chuỗi này có cấu trúc trông đúng nhưng phần salt `qN8kE6/1Q5qX0W1v0G2J5Q` và hash `R5N5M2mYjPqL7P8b1N3rYQ` ngắn hơn chuẩn (salt argon2id chuẩn là 16 bytes = 22 base64 chars, hash là 32 bytes = 43 chars). Đây là hash giả — không thể xác thực được từ bất kỳ mật khẩu nào.

**Đề xuất sửa:**
- Tách seed ra file riêng `db/seed_dev.sql` (hoặc `prisma/seed.ts`).
- File schema chỉ chứa DDL.
- Seed cần: TRUNCATE ... RESTART IDENTITY CASCADE để chạy lại được; hash argon2 thật sinh bằng script Node; ghi mật khẩu dev vào `docs/database.md`.

**Rủi ro khi sửa:** Trung bình — cần cập nhật hướng dẫn setup và CI pipeline.

---

### B3. `SET LOCAL search_path` chỉ có hiệu lực trong transaction — **CAO**

**Skill:** PG, SP  
**Vị trí:** `scripts/khoi_tao_database.sql` dòng 33; `docs/sql/tao_csdl_gia_pha_v1_2.sql` dòng 10  
**Mức độ:** Cao  

**Vấn đề:** `SET LOCAL search_path TO gia_pha, public` chỉ có hiệu lực trong transaction hiện tại. Sau khi transaction COMMIT, `search_path` trở về mặc định (`public`). Ứng dụng Prisma kết nối với `?schema=public` trong DATABASE_URL (xem `docker-compose.yml` dòng 37), nên **Prisma không bao giờ tìm vào schema `gia_pha`**.

Điều này có nghĩa là toàn bộ schema `gia_pha` hiện tại (được tạo bởi `scripts/khoi_tao_database.sql`) **không được ứng dụng sử dụng**. Ứng dụng chạy hoàn toàn trên schema `public` do Prisma migration tạo ra.

**Kiểm tra:** `docker-compose.yml` line 37:
```
DATABASE_URL: postgresql://...@db:5432/giapha?schema=public
```

**Đề xuất:** Nếu muốn ứng dụng dùng schema `gia_pha`, đổi `?schema=gia_pha`. Nếu muốn giữ `public`, cần ghi rõ trong tài liệu rằng hai schema tồn tại song song và không liên quan nhau. Hiện trạng gây nhầm lẫn.

**Rủi ro khi sửa:** Cao nếu đổi schema của Prisma — cần migration mới và kiểm tra toàn bộ query. Thấp nếu chỉ tài liệu hóa rõ hai schema tách rời.

---

### B4. Extension `citext` và `pgcrypto` bật nhưng không dùng — **CAO**

**Skill:** PG  
**Vị trí:** `scripts/khoi_tao_database.sql` dòng 28–29  
**Mức độ:** Cao (trong ngữ cảnh đây là file setup chính thức)  

**Kết quả grep:**
- `citext`: KHÔNG có cột nào dùng type `CITEXT` trong SQL. Email (`tai_khoan.email`) là `VARCHAR(254)` với partial index `lower(email)`. Đây là cách thay thế tốt, nhưng nếu đã bật `citext` thì nên dùng hoặc bỏ extension.
- `pgcrypto`: KHÔNG có lần gọi `crypt()`, `gen_salt()`, `pgp_*` hay `encode()` nào trong toàn bộ SQL. Hash mật khẩu được thực hiện ở tầng ứng dụng (argon2).
- Cả hai extension đều không xuất hiện trong source code TypeScript của ứng dụng.

**Đề xuất sửa:** Bỏ hai dòng `CREATE EXTENSION` nếu không có kế hoạch dùng trong tương lai gần. Nếu có kế hoạch, ghi chú mục đích.

**Rủi ro khi sửa:** Thấp. Extension chưa dùng nên bỏ không ảnh hưởng dữ liệu. Cần chắc chắn không có đoạn code nào phụ thuộc trước khi bỏ.

---

### B5. `fn_xu_ly_ho_so_qua_doi` — lọc theo `dong_ho_id` có thể bỏ sót vai trò — **CAO**

**Skill:** PG  
**Vị trí:** `scripts/khoi_tao_database.sql` dòng 527–542  
**Mức độ:** Cao  

**Vấn đề:** Khi hồ sơ chuyển sang `DA_MAT`, trigger kết thúc vai trò bằng điều kiện:
```sql
WHERE th.tai_khoan_id = v.tai_khoan_id
  AND th.dong_ho_id = NEW.dong_ho_id   -- ← lọc theo dong_ho_id của hồ sơ vừa mất
  AND th.ho_so_id = NEW.id
  AND v.hieu_luc_den IS NULL;
```

Một tài khoản có thể tham gia nhiều dòng họ (bảng `tai_khoan_ho_so` cho phép `(tai_khoan_id, dong_ho_id)` unique). Nếu tài khoản có vai trò trong dòng họ B nhưng hồ sơ `DA_MAT` thuộc dòng họ A, **vai trò trong dòng họ B không bị kết thúc**. Điều này đúng về nghiệp vụ (không nên kết thúc vai trò ở dòng họ khác khi chỉ có hồ sơ ở dòng họ A mất). Tuy nhiên, **khóa tài khoản** (`UPDATE tai_khoan SET trang_thai='BI_KHOA'`) được áp dụng cho **toàn bộ tài khoản** bất kể dòng họ nào — điều này ảnh hưởng đến tất cả dòng họ mà tài khoản tham gia.

Có sự **không nhất quán**: khóa tài khoản là toàn cục, nhưng kết thúc vai trò chỉ trong một dòng họ. Nếu đây là thiết kế có chủ đích, cần ghi chú rõ trong code.

**Đề xuất:** Thêm comment giải thích quyết định thiết kế:
```sql
-- Khóa tài khoản toàn cục: một người đã mất không nên tiếp tục hoạt động ở bất kỳ dòng họ nào.
-- Kết thúc vai trò chỉ trong dong_ho_id của hồ sơ vừa mất: tránh ảnh hưởng đến dòng họ khác
-- nếu tài khoản có hồ sơ ở nhiều dòng họ (trường hợp hiếm nhưng hợp lệ về dữ liệu).
```

Hoặc nếu logic muốn kết thúc vai trò ở mọi dòng họ khi tài khoản bị khóa, bỏ điều kiện `th.dong_ho_id = NEW.dong_ho_id`.

**Rủi ro khi sửa:** Trung bình — thay đổi nghiệp vụ, cần xác nhận với stakeholder.

---

### B6. `fn_chan_vong_pha_he` — khóa toàn bộ dòng họ gây tranh chấp — **CAO**

**Skill:** SP (Concurrency & Locking), PG  
**Vị trí:** `scripts/khoi_tao_database.sql` dòng 467–486  
**Mức độ:** Cao  

**Vấn đề:**
```sql
PERFORM 1 FROM dong_ho WHERE id=dong_ho_a FOR UPDATE;
```
Lệnh này lock **toàn bộ hàng dòng họ** mỗi khi thêm hoặc sửa một quan hệ cha-con. Trong một dòng họ lớn (hàng nghìn thành viên), hai thành viên cùng cập nhật cây phả hệ đồng thời sẽ phải đợi nhau do lock này. Đây là bottleneck nghiêm trọng khi có nhiều concurrent writer.

**Lý do dùng lock:** Ngăn race condition khi hai transaction đồng thời thêm quan hệ tạo vòng tổ tiên. Ý định đúng, nhưng phạm vi lock quá rộng.

**Đề xuất:** Dùng advisory lock cấp hàng thay vì row lock toàn bảng `dong_ho`:
```sql
-- Thay FOR UPDATE trên dong_ho bằng advisory lock theo dong_ho_id
PERFORM pg_advisory_xact_lock(dong_ho_a);
```
Advisory lock nhẹ hơn, không block read, nhưng vẫn đảm bảo mutual exclusion cho cùng một dòng họ. Các dòng họ khác nhau không chặn nhau.

**Rủi ro khi sửa:** Trung bình — cần kiểm thử tải đồng thời sau khi đổi.

---

### B7. Khóa ngoại thiếu index — **TRUNG BÌNH**

**Skill:** SP (Query Performance — Missing Indexes), PG  
**Vị trí:** Nhiều bảng  
**Mức độ:** Trung bình  

PostgreSQL tự động tạo index cho PRIMARY KEY và UNIQUE, nhưng **không** tạo index cho foreign key. Các FK sau không có index riêng và có khả năng xuất hiện trong JOIN thường xuyên:

| Bảng | Cột FK thiếu index | Truy vấn điển hình bị ảnh hưởng |
|------|--------------------|----------------------------------|
| `yeu_cau_cap_nhat_pha_he` | `dong_ho_id` | Danh sách yêu cầu chờ duyệt theo dòng họ |
| `yeu_cau_cap_nhat_pha_he` | `tai_khoan_tao_id` | Lịch sử yêu cầu của một tài khoản |
| `quyet_dinh_duyet` | `nguoi_duyet_id` | Lịch sử duyệt của Trưởng họ |
| `trao_doi_yeu_cau` | `tai_khoan_id` | Tìm tin nhắn của một người dùng |
| `thong_bao` | `su_kien_id` | Thông báo về một sự kiện cụ thể |
| `bai_viet` | `tai_khoan_id` | Bài viết của một tài khoản |
| `binh_luan` | `tai_khoan_id` | Bình luận của một tài khoản |
| `giao_dich_quy` | `yeu_cau_dong_gop_id` | Tìm giao dịch từ yêu cầu (đã có UNIQUE index — OK) |
| `phieu_bau_truong_ho` | `dong_ho_id` | Phiếu bầu trong một dòng họ |
| `dot_dong_gop` | `quy_id` | Đợt đóng góp theo quỹ |
| `yeu_cau_dong_gop` | `dot_dong_gop_id` | Yêu cầu trong một đợt |
| `yeu_cau_dong_gop` | `tai_khoan_id` | Yêu cầu của một thành viên |

**Đề xuất sửa (ví dụ các index quan trọng nhất):**
```sql
-- Danh sách CHỜ DUYỆT theo dòng họ (query thường xuyên nhất của Trưởng họ)
CREATE INDEX IF NOT EXISTS idx_yccn_dong_ho_trang_thai
  ON yeu_cau_cap_nhat_pha_he(dong_ho_id, trang_thai);

-- Lịch sử yêu cầu của người tạo
CREATE INDEX IF NOT EXISTS idx_yccn_tai_khoan_tao
  ON yeu_cau_cap_nhat_pha_he(tai_khoan_tao_id);

-- Phiếu bầu (JOIN thường xuyên khi tổng hợp kết quả)
CREATE INDEX IF NOT EXISTS idx_phieu_bau_dong_ho
  ON phieu_bau_truong_ho(dong_ho_id);

-- Yêu cầu đóng góp theo đợt
CREATE INDEX IF NOT EXISTS idx_ycdg_dot_dong_gop
  ON yeu_cau_dong_gop(dot_dong_gop_id, trang_thai);

-- Yêu cầu đóng góp của thành viên
CREATE INDEX IF NOT EXISTS idx_ycdg_tai_khoan
  ON yeu_cau_dong_gop(tai_khoan_id);
```

**Rủi ro khi sửa:** Thấp. Thêm index không ảnh hưởng correctness.

---

### B8. Index thừa / có thể bao gộp — **TRUNG BÌNH**

**Skill:** SP, PG  
**Vị trí:** `vai_tro_phan_quyen`, `quan_he_pha_he`  
**Mức độ:** Trung bình  

1. **`idx_vai_tro_tai_khoan`** trên `vai_tro_phan_quyen(tai_khoan_id)` — đã được bao gộp bởi index `(accountId, validTo)` trong Prisma migration (hoặc tương đương trong SQL). Index đơn cột thừa nếu index composite đã có `tai_khoan_id` ở đầu.

2. **`idx_qh_tu`** và **`idx_qh_den`** là partial index chỉ WHERE `hieu_luc`. Tuy nhiên, khi truy vấn cây phả hệ đầy đủ (kể cả quan hệ đã kết thúc để tính lịch sử), các index này không được dùng. Nếu phần lớn quan hệ là `hieu_luc=true`, partial index là tối ưu. Nếu ngược lại, cần index toàn phần.

**Đề xuất:** Giữ partial index nhưng ghi comment rõ:
```sql
-- Phục vụ: duyệt cây phả hệ hiện tại (hieu_luc=true), không dùng cho lịch sử.
CREATE INDEX IF NOT EXISTS idx_qh_tu ON quan_he_pha_he(tu_ho_so_id) WHERE hieu_luc;
```

---

### B9. Partial index `idx_thong_bao_hang_doi` chưa đủ chọn lọc — **TRUNG BÌNH**

**Skill:** SP (Partial Indexes), PG  
**Vị trí:** `scripts/khoi_tao_database.sql` dòng 361  
**Mức độ:** Trung bình  

Index hiện tại:
```sql
CREATE INDEX IF NOT EXISTS idx_thong_bao_hang_doi ON thong_bao(trang_thai_gui, lan_thu_tiep_theo);
```

Worker gửi thông báo thường xuyên chạy query dạng:
```sql
SELECT * FROM thong_bao
WHERE trang_thai_gui = 'CHO_GUI'
  AND (lan_thu_tiep_theo IS NULL OR lan_thu_tiep_theo <= now())
ORDER BY lan_thu_tiep_theo
LIMIT 100;
```

Theo thời gian, hàng `DA_GUI` và `LOI` tích lũy nhiều nhưng vô dụng cho query này. Partial index chỉ trên hàng chưa gửi sẽ nhỏ hơn nhiều:

**Đề xuất sửa:**
```sql
-- Hàng đợi gửi thông báo: chỉ index các thông báo chưa gửi thành công
DROP INDEX IF EXISTS idx_thong_bao_hang_doi;
CREATE INDEX IF NOT EXISTS idx_thong_bao_hang_doi
  ON thong_bao(lan_thu_tiep_theo NULLS FIRST)
  WHERE trang_thai_gui = 'CHO_GUI';
```

**Rủi ro khi sửa:** Thấp. Cần test EXPLAIN ANALYZE sau khi đổi.

---

### B10. Kiểu tiền `NUMERIC(15,2)` vs `NUMERIC(18,0)` không nhất quán — **TRUNG BÌNH**

**Skill:** PG  
**Vị trí:** `quy.so_du_dau_ky`, `yeu_cau_dong_gop.so_tien`, `giao_dich_quy.so_tien` (SQL) vs `Fund.openingBalance`, `ContributionRequest.amount`, `FundTransaction.amount` (Prisma)  
**Mức độ:** Trung bình  

Trong file SQL: tiền được lưu dưới dạng `NUMERIC(15,2)` (VND với phần thập phân). Trong Prisma migration: `DECIMAL(18,0)` (không có phần thập phân). VND không có phần thập phân trong thực tế, nhưng hai nguồn không nhất quán.

**Đề xuất:** Chọn một chuẩn và ghi vào `docs/database.md`:
- `NUMERIC(15,0)` cho VND (không cần phần thập phân).
- Hoặc `NUMERIC(15,2)` nếu muốn hỗ trợ ngoại tệ sau này.

---

### B11. `TIMESTAMP(3)` thay vì `TIMESTAMPTZ` trong Prisma migration — **TRUNG BÌNH**

**Skill:** PG  
**Vị trí:** `migration.sql` — tất cả cột timestamp  
**Mức độ:** Trung bình  

Prisma mặc định sinh `TIMESTAMP(3)` (không có timezone). File SQL (`gia_pha`) dùng `TIMESTAMPTZ` nhất quán. Ứng dụng triển khai tại Việt Nam (UTC+7) nhưng nếu server DB ở UTC, dữ liệu sẽ bị lệch khi đọc trực tiếp qua psql/pgAdmin.

**Đề xuất:** Trong `prisma/schema.prisma`, thêm:
```prisma
generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```
Prisma không hỗ trợ `TIMESTAMPTZ` natively — workaround là dùng `@db.Timestamptz` annotation. Hoặc đảm bảo `timezone = 'UTC'` trong PostgreSQL config và xử lý timezone ở tầng ứng dụng.

---

### B12. `ON DELETE SET NULL` trên `MemberProfile.branchId` có thể gây hồ sơ mồ côi — **TRUNG BÌNH**

**Skill:** PG  
**Vị trí:** `migration.sql` dòng 576  
**Mức độ:** Trung bình  

```sql
ALTER TABLE "MemberProfile" ADD CONSTRAINT "MemberProfile_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL;
```

Khi một chi bị xóa, `branchId` của tất cả thành viên trong chi đó sẽ tự động SET NULL — họ trở thành thành viên "không chi". Điều này có thể hợp lý nếu chi được hợp nhất, nhưng nguy hiểm nếu là xóa nhầm. File SQL dùng `ON DELETE RESTRICT` (không cho xóa chi khi còn thành viên) — đây là lựa chọn an toàn hơn.

**Đề xuất:** Đổi thành `ON DELETE RESTRICT` để ép ứng dụng xử lý explicit.

---

### B13. `ApprovalDecision` trong Prisma không có trigger chống tự duyệt — **TRUNG BÌNH**

**Skill:** PG  
**Vị trí:** `migration.sql`  
**Mức độ:** Trung bình  

File SQL có trigger `fn_chan_tu_duyet` ngăn người tạo yêu cầu tự duyệt (BR-12). Prisma migration tạo bảng `ApprovalDecision` nhưng **không có trigger tương đương**. Chỉ có constraint CHECK trong `Account`:
```sql
-- Không có trigger nào trong migration.sql bảo vệ việc tự duyệt
```

Hiện tại rule này chỉ được enforce ở tầng ứng dụng (nếu có). Nếu có bug hay bypass ở service layer, DB không chặn được.

**Đề xuất:** Thêm trigger tương đương vào migration mới cho Prisma.

---

### B14. `quyet_dinh_duyet` trong SQL thiếu `yeu_cau_dong_gop` — **TRUNG BÌNH**

**Skill:** PG  
**Vị trí:** `scripts/khoi_tao_database.sql` dòng 266–275  
**Mức độ:** Trung bình  

Bảng `quyet_dinh_duyet` có constraint:
```sql
CHECK (num_nonnulls(yeu_cau_gia_nhap_id, yeu_cau_cap_nhat_id) = 1)
```
Chỉ cho phép duyệt yêu cầu gia nhập HOẶC cập nhật phả hệ. Nhưng Prisma migration có thêm `contributionRequestId` cho phép duyệt yêu cầu đóng góp qua cùng bảng này. Hai nguồn mâu thuẫn về nghiệp vụ.

**Đề xuất:** Xác định một nguồn là chuẩn. Nếu cần duyệt đóng góp qua `quyet_dinh_duyet`, cập nhật SQL và constraint. Nếu không, bỏ `contributionRequestId` khỏi Prisma.

---

### B15. `vai_tro_phan_quyen.chi_id` FK không có index riêng (SQL) — **TRUNG BÌNH**

**Skill:** SP  
**Vị trí:** `scripts/khoi_tao_database.sql` dòng 163–168  
**Mức độ:** Trung bình  

Có partial unique index `uq_truong_chi_hien_hanh(chi_id) WHERE loai_vai_tro='TRUONG_CHI' AND pham_vi='CHI' AND hieu_luc_den IS NULL` nhưng không có index thông thường trên `chi_id` cho query tổng quát (ví dụ: lấy tất cả vai trò của một chi).

**Đề xuất:**
```sql
CREATE INDEX IF NOT EXISTS idx_vai_tro_chi ON vai_tro_phan_quyen(chi_id) WHERE chi_id IS NOT NULL;
```

---

### B16. `trao_doi_yeu_cau` thiếu index trên `tai_khoan_id` — **THẤP**

**Skill:** SP  
**Vị trí:** `scripts/khoi_tao_database.sql` dòng 258–264  
**Mức độ:** Thấp  

Query điển hình "tìm tin nhắn của một người trong yêu cầu X" cần `(yeu_cau_cap_nhat_id, tai_khoan_id)`. Hiện chỉ có FK không có index bổ sung.

---

### B17. Seed dùng `OVERRIDING SYSTEM VALUE` với ID cứng — **THẤP**

**Skill:** PG  
**Vị trí:** `scripts/khoi_tao_database.sql` dòng 565+  
**Mức độ:** Thấp  

Dùng `OVERRIDING SYSTEM VALUE` để chèn ID cứng (1, 2, 3...) là đúng về mặt kỹ thuật với `GENERATED BY DEFAULT AS IDENTITY`. Tuy nhiên, sau khi seed, cần `setval` để tránh conflict với insert tự động — đã có ở cuối file. Vấn đề: `setval(... COALESCE(MAX(id), 1))` sẽ set sequence về 1 nếu bảng rỗng, dẫn đến conflict khi insert record đầu tiên sau đó. Đúng hơn là `COALESCE(MAX(id), 0) + 1` hoặc dùng `setval(..., MAX(id))`.

**Rủi ro:** Thấp — chỉ ảnh hưởng môi trường dev sau khi truncate.

---

### B18. `su_kien.ngay_duong` — index đơn cột có thể kém hiệu quả — **THẤP**

**Skill:** SP  
**Vị trí:** `scripts/khoi_tao_database.sql` dòng 347  
**Mức độ:** Thấp  

Query lịch sự kiện thường lọc theo `dong_ho_id` VÀ `ngay_duong`. Index đơn `idx_su_kien_ngay_duong(ngay_duong)` ít chọn lọc hơn composite index.

**Đề xuất:**
```sql
-- Phục vụ: lịch sự kiện của dòng họ trong khoảng thời gian (truy vấn trang chủ)
CREATE INDEX IF NOT EXISTS idx_su_kien_dong_ho_ngay
  ON su_kien(dong_ho_id, ngay_duong);
```

---

### B19. Tên ràng buộc không rõ ràng trong SQL — **THẤP**

**Skill:** PG  
**Vị trí:** Nhiều bảng  
**Mức độ:** Thấp  

Các CHECK constraint inline không đặt tên tường minh (PostgreSQL tự sinh tên dạng `ho_so_thanh_vien_check`, `ho_so_thanh_vien_check1`...). Khi constraint bị vi phạm, error message khó debug.

**Đề xuất (ví dụ):**
```sql
CONSTRAINT chk_ngay_mat_sau_ngay_sinh CHECK (ngay_mat IS NULL OR ngay_sinh IS NULL OR ngay_mat >= ngay_sinh),
CONSTRAINT chk_trang_thai_khi_co_ngay_mat CHECK (ngay_mat IS NULL OR trang_thai <> 'DANG_SONG'),
CONSTRAINT chk_lich_ngay_mat_nhat_quan CHECK ((ngay_mat IS NULL) = (loai_lich_ngay_mat IS NULL))
```

---

### B20. `bai_viet` thiếu index cho danh sách bài viết chưa bị ẩn/xóa — **THẤP**

**Skill:** SP  
**Vị trí:** `scripts/khoi_tao_database.sql` dòng 301  
**Mức độ:** Thấp  

Index hiện tại: `idx_bai_viet_bang_tin(dong_ho_id, pham_vi, tao_luc DESC)`. Query bảng tin thường xuyên lọc thêm `trang_thai = 'DA_XUAT_BAN'`. Partial index sẽ nhỏ hơn và nhanh hơn:

```sql
-- Bảng tin dòng họ: chỉ bài viết đang hiển thị
DROP INDEX IF EXISTS idx_bai_viet_bang_tin;
CREATE INDEX IF NOT EXISTS idx_bai_viet_bang_tin
  ON bai_viet(dong_ho_id, pham_vi, tao_luc DESC)
  WHERE trang_thai = 'DA_XUAT_BAN';
```

---

### B21. `Attachment` trong Prisma thiếu constraint "exactly one parent" — **THẤP**

**Skill:** PG  
**Vị trí:** `migration.sql` bảng `Attachment`  
**Mức độ:** Thấp  

File SQL có:
```sql
CHECK (num_nonnulls(bai_viet_id, yeu_cau_cap_nhat_id, yeu_cau_gia_nhap_id) = 1)
```
Prisma migration không có CHECK constraint tương đương trên `Attachment` — một tệp có thể không thuộc về thực thể nào, hoặc thuộc nhiều thực thể cùng lúc.

---

### B22. `giao_dich_quy.ngay` dùng `DATE` thay vì `TIMESTAMPTZ` — **THẤP**

**Skill:** PG  
**Vị trí:** `scripts/khoi_tao_database.sql` dòng 439  
**Mức độ:** Thấp  

Ngày giao dịch tài chính lưu dưới dạng `DATE` (chỉ có ngày, không có giờ). Nếu cần audit trail chính xác về thời điểm giao dịch, nên dùng `TIMESTAMPTZ`. Hiện tại `tao_luc TIMESTAMPTZ` đã có, nhưng `ngay` là ngày giao dịch thực tế (có thể khác ngày nhập liệu), nên `DATE` là hợp lý về nghiệp vụ — chỉ cần ghi chú.

---

### B23. `dot_dong_gop.bat_dau` và `ket_thuc` dùng `DATE` — khó lọc theo timestamp — **THẤP**

**Skill:** PG  
**Vị trí:** `scripts/khoi_tao_database.sql` dòng 418–421; Prisma `Campaign.startAt/endAt` dùng `TIMESTAMP(3)`  
**Mức độ:** Thấp  

SQL dùng `DATE`, Prisma dùng `TIMESTAMP(3)` — không nhất quán nhưng ít ảnh hưởng nghiệp vụ vì chỉ là khoảng thời gian chiến dịch.

---

## C. Tổng hợp theo điểm bắt buộc kiểm tra

| Điểm | Phát hiện | Mục báo cáo |
|------|-----------|-------------|
| a. Trigger chuyển trạng thái `yeu_cau_dong_gop` | **XÁC NHẬN** — không có trigger | B1 |
| b. Hash argon2 giả trong seed | **XÁC NHẬN** — cùng chuỗi giả cho 3 tài khoản; seed lẫn schema | B2 |
| c. `SET LOCAL search_path` — Prisma dùng `public`, không phải `gia_pha` | **XÁC NHẬN** — hai schema tách rời hoàn toàn | B3 |
| d. Extension `citext`, `pgcrypto` không dùng | **XÁC NHẬN** — grep không tìm thấy usage | B4 |
| e. FK thiếu index; index thừa/trùng; partial index hàng đợi thông báo | **XÁC NHẬN** — nhiều FK thiếu index; partial index thông báo chưa tối ưu | B7, B8, B9 |
| f. An toàn đồng thời trong `fn_chan_vong_pha_he`; lọc trong `fn_xu_ly_ho_so_qua_doi` | **XÁC NHẬN** — lock quá rộng; sự không nhất quán lock/kết thúc vai trò | B6, B5 |
| g. Kiểu dữ liệu; tiền; TIMESTAMPTZ; ON DELETE; tên constraint | **XÁC NHẬN** — xem B10–B13, B19 | B10–B13, B19 |

---

## D. Danh sách đề xuất cho Giai đoạn 2 (chờ phê duyệt)

Thứ tự mặc định theo yêu cầu ban đầu:

1. **[B1]** Thêm trigger `fn_kiem_tra_trang_thai_dong_gop` cho `yeu_cau_dong_gop`
2. **[B2]** Tách seed ra `db/seed_dev.sql`; sinh hash argon2 thật; ghi mật khẩu dev vào `docs/database.md`
3. **[B4]** Bỏ extension `citext` và `pgcrypto` (đã xác nhận không dùng)
4. **[B3]** Tài liệu hóa rõ hai schema; cập nhật `docs/database.md` về cách Prisma/ứng dụng chọn schema
5. **[B7]** Thêm các index FK còn thiếu quan trọng nhất
6. **[B8, B9, B18, B20]** Tối ưu partial index thông báo, bài viết, sự kiện
7. Các mục khác theo lựa chọn của bạn

---

*Giai đoạn 1 kết thúc. File này chỉ ghi phát hiện, chưa sửa bất kỳ file nào ngoài báo cáo này.*
