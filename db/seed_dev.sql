/*
================================================================================
DỮ LIỆU MẪU PHÁT TRIỂN (DEV SEED) — schema gia_pha
Chỉ dùng cho môi trường dev/staging. KHÔNG chạy trên production.

Chạy lại được nhiều lần (idempotent):
  1. Xóa sạch dữ liệu mẫu theo thứ tự FK ngược
  2. Reset sequence
  3. Chèn lại dữ liệu

Cách chạy:
  docker compose exec -T db psql -U giapha -d giapha \
    -c "SET search_path TO gia_pha, public;" \
    -f /workspace/db/seed_dev.sql

Hoặc từ Windows PowerShell:
  Get-Content db/seed_dev.sql | docker compose exec -T db psql -U giapha -d giapha

Mật khẩu dev (argon2id, cost m=65536,t=3,p=4):
  truongho@giapha.vn   → Dev@123456
  truongchi@giapha.vn  → Dev@123456
  thanhvien@giapha.vn  → Dev@123456
  (Hash được sinh bằng scripts/gen_seed_hashes.cjs — xem docs/database.md)
================================================================================
*/

SET search_path TO gia_pha, public;

BEGIN;

-- ============================================================
-- XÓA DỮ LIỆU MẪU THEO THỨ TỰ FK NGƯỢC
-- ============================================================
DELETE FROM chung_tu             WHERE id <= 100;
DELETE FROM giao_dich_quy        WHERE id <= 100;
DELETE FROM yeu_cau_dong_gop     WHERE id <= 100;
DELETE FROM dot_dong_gop         WHERE id <= 100;
DELETE FROM quy                  WHERE id <= 100;
DELETE FROM phieu_bau_truong_ho  WHERE id <= 100;
DELETE FROM phien_chon_truong_ho WHERE id <= 100;
DELETE FROM thong_bao            WHERE id <= 100;
DELETE FROM su_kien              WHERE id <= 100;
DELETE FROM cam_xuc              WHERE id <= 100;
DELETE FROM binh_luan            WHERE id <= 100;
DELETE FROM tep_dinh_kem         WHERE id <= 100;
DELETE FROM bai_viet             WHERE id <= 100;
DELETE FROM cau_hinh_rieng_tu    WHERE id <= 100;
DELETE FROM quan_he_pha_he       WHERE id <= 100;
DELETE FROM vai_tro_phan_quyen   WHERE id <= 100;
DELETE FROM xac_thuc_totp        WHERE id <= 100;
DELETE FROM tai_khoan_ho_so      WHERE id <= 100;
-- Gỡ nút gốc và trưởng chi trước khi xóa hồ sơ
UPDATE dong_ho SET ho_so_goc_id = NULL WHERE id = 1;
UPDATE chi SET ho_so_truong_chi_id = NULL WHERE id <= 10;
DELETE FROM ho_so_thanh_vien     WHERE id <= 100;
DELETE FROM tai_khoan            WHERE id <= 100;
DELETE FROM chi                  WHERE id <= 10;
DELETE FROM dong_ho              WHERE id <= 10;

-- ============================================================
-- RESET SEQUENCE VỀ 0 (thêm record tiếp theo sẽ bắt đầu từ 1)
-- ============================================================
SELECT setval(pg_get_serial_sequence('dong_ho',            'id'), 1, false);
SELECT setval(pg_get_serial_sequence('chi',                'id'), 1, false);
SELECT setval(pg_get_serial_sequence('ho_so_thanh_vien',   'id'), 1, false);
SELECT setval(pg_get_serial_sequence('tai_khoan',          'id'), 1, false);
SELECT setval(pg_get_serial_sequence('xac_thuc_totp',      'id'), 1, false);
SELECT setval(pg_get_serial_sequence('tai_khoan_ho_so',    'id'), 1, false);
SELECT setval(pg_get_serial_sequence('vai_tro_phan_quyen', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('quan_he_pha_he',     'id'), 1, false);
SELECT setval(pg_get_serial_sequence('cau_hinh_rieng_tu',  'id'), 1, false);
SELECT setval(pg_get_serial_sequence('bai_viet',           'id'), 1, false);
SELECT setval(pg_get_serial_sequence('tep_dinh_kem',       'id'), 1, false);
SELECT setval(pg_get_serial_sequence('binh_luan',          'id'), 1, false);
SELECT setval(pg_get_serial_sequence('cam_xuc',            'id'), 1, false);
SELECT setval(pg_get_serial_sequence('su_kien',            'id'), 1, false);
SELECT setval(pg_get_serial_sequence('thong_bao',          'id'), 1, false);
SELECT setval(pg_get_serial_sequence('phien_chon_truong_ho','id'), 1, false);
SELECT setval(pg_get_serial_sequence('phieu_bau_truong_ho','id'), 1, false);
SELECT setval(pg_get_serial_sequence('quy',                'id'), 1, false);
SELECT setval(pg_get_serial_sequence('dot_dong_gop',       'id'), 1, false);
SELECT setval(pg_get_serial_sequence('yeu_cau_dong_gop',   'id'), 1, false);
SELECT setval(pg_get_serial_sequence('giao_dich_quy',      'id'), 1, false);
SELECT setval(pg_get_serial_sequence('chung_tu',           'id'), 1, false);

-- ============================================================
-- 1. DÒNG HỌ
-- ============================================================
INSERT INTO dong_ho (id, ma_gia_pha, ten, trang_thai)
OVERRIDING SYSTEM VALUE
VALUES (1, 'GP-NGUYEN-2026', 'Dòng họ Nguyễn Phúc', 'DANG_HOAT_DONG');

-- ============================================================
-- 2. CHI TỘC
-- ============================================================
INSERT INTO chi (id, dong_ho_id, ten_chi)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, 'Chi Trưởng (Nhất Chi)'),
  (2, 1, 'Chi Thứ (Nhị Chi)');

-- ============================================================
-- 3. HỒ SƠ THÀNH VIÊN — 3 thế hệ
--    Đời 1: Cụ Khởi (Thủy tổ) & Cụ Lành — đã mất
--    Đời 2: Ông An (Trưởng họ), Bà Hoa (vợ Ông An), Ông Bình (Trưởng Chi Thứ)
--    Đời 3: Anh Cường, Chị Dung (con Ông An & Bà Hoa)
-- ============================================================
INSERT INTO ho_so_thanh_vien
  (id, dong_ho_id, chi_id, ma_thanh_vien, ho_ten, gioi_tinh,
   ngay_sinh, ngay_mat, loai_lich_ngay_mat, so_dien_thoai,
   noi_an_tang, the_he, trang_thai, version)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, NULL, 'TV-001', 'Nguyễn Phúc Khởi', 'NAM',
   '1920-01-01', '2000-08-15', 'AM', NULL,
   'Khu lăng mộ tổ họ Nguyễn Phúc, Phú Vang, Thừa Thiên Huế', 1, 'DA_MAT', 1),
  (2, 1, NULL, 'TV-002', 'Trần Thị Lành', 'NU',
   '1925-05-10', '2005-03-20', 'AM', NULL,
   'Khu nghĩa trang gia tộc, Phú Vang, Thừa Thiên Huế', 1, 'DA_MAT', 1),
  (3, 1, 1, 'TV-003', 'Nguyễn Phúc An', 'NAM',
   '1950-02-15', NULL, NULL, '+84901234567', NULL, 2, 'DANG_SONG', 1),
  (4, 1, 1, 'TV-004', 'Lê Thị Hoa', 'NU',
   '1953-06-20', NULL, NULL, '+84902345678', NULL, 2, 'DANG_SONG', 1),
  (5, 1, 2, 'TV-005', 'Nguyễn Phúc Bình', 'NAM',
   '1955-09-12', NULL, NULL, '+84912345678', NULL, 2, 'DANG_SONG', 1),
  (6, 1, 1, 'TV-006', 'Nguyễn Phúc Cường', 'NAM',
   '1980-11-20', NULL, NULL, '+84923456789', NULL, 3, 'DANG_SONG', 1),
  (7, 1, 1, 'TV-007', 'Nguyễn Phúc Dung', 'NU',
   '1985-04-18', NULL, NULL, '+84934567890', NULL, 3, 'DANG_SONG', 1);

-- Gán nút gốc và trưởng chi
UPDATE dong_ho SET ho_so_goc_id = 1 WHERE id = 1;
UPDATE chi SET ho_so_truong_chi_id = 3 WHERE id = 1;
UPDATE chi SET ho_so_truong_chi_id = 5 WHERE id = 2;

-- ============================================================
-- 4. TÀI KHOẢN
--    Hash argon2id sinh bằng scripts/gen_seed_hashes.cjs
--    Mật khẩu dev: Dev@123456 (ghi trong docs/database.md)
-- ============================================================
INSERT INTO tai_khoan
  (id, ma_tai_khoan, so_dien_thoai, email, mat_khau_hash, loai_xac_thuc, google_sub, trang_thai)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 'TK-001', '+84901234567', 'truongho@giapha.vn',
   '$argon2id$v=19$m=65536,t=3,p=4$c2VlZHNhbHQwMDAwMDAxAA$hM6s1PiFWnVvKkYa3dOTRiKlBEfvnDlQ2c7MxKjSXoY',
   'NOI_BO', NULL, 'HOAT_DONG'),
  (2, 'TK-002', '+84912345678', 'truongchi@giapha.vn',
   '$argon2id$v=19$m=65536,t=3,p=4$c2VlZHNhbHQwMDAwMDAyAA$3vKpQmJ8nFWXzLdT9rNhYoUgCsBxEiPa7ktMwDHqZlc',
   'NOI_BO', NULL, 'HOAT_DONG'),
  (3, 'TK-003', '+84923456789', 'thanhvien@giapha.vn',
   '$argon2id$v=19$m=65536,t=3,p=4$c2VlZHNhbHQwMDAwMDAzAA$KpRnT4vXmGsWzLhJ8fByCdUqAiEo6jwMtxNDlPeHQkY',
   'NOI_BO', NULL, 'HOAT_DONG'),
  (4, 'TK-004', '+84934567890', 'nguyenphucdung.dev@gmail.com',
   NULL, 'GOOGLE', 'google-oauth2|109283746582910283746', 'HOAT_DONG');

-- ============================================================
-- 5. XÁC THỰC TOTP (2FA cho Trưởng họ — dev secret, không dùng prod)
-- ============================================================
INSERT INTO xac_thuc_totp (id, tai_khoan_id, khoa_bi_mat_ma_hoa, da_kich_hoat)
OVERRIDING SYSTEM VALUE
VALUES (1, 1, 'dev_totp_secret_truongho_NOT_FOR_PROD', true);

-- ============================================================
-- 6. LIÊN KẾT TÀI KHOẢN ↔ HỒ SƠ
-- ============================================================
INSERT INTO tai_khoan_ho_so (id, tai_khoan_id, dong_ho_id, ho_so_id)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, 1, 3),  -- TK-001 (truongho)  → Ông An
  (2, 2, 1, 5),  -- TK-002 (truongchi) → Ông Bình
  (3, 3, 1, 6),  -- TK-003 (thanhvien) → Anh Cường
  (4, 4, 1, 7);  -- TK-004 (google)    → Chị Dung

-- ============================================================
-- 7. VAI TRÒ & PHÂN QUYỀN
-- ============================================================
INSERT INTO vai_tro_phan_quyen
  (id, tai_khoan_id, loai_vai_tro, pham_vi, dong_ho_id, chi_id, hieu_luc_tu)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, 'TRUONG_HO',  'TOAN_HO', 1, NULL, CURRENT_DATE),
  (2, 2, 'TRUONG_CHI', 'CHI',  NULL, 2, CURRENT_DATE),
  (3, 3, 'THANH_VIEN', 'CHI',  NULL, 1, CURRENT_DATE),
  (4, 4, 'THANH_VIEN', 'CHI',  NULL, 1, CURRENT_DATE);

-- ============================================================
-- 8. QUAN HỆ PHẢ HỆ — cây 3 đời
-- ============================================================
INSERT INTO quan_he_pha_he (id, tu_ho_so_id, den_ho_so_id, loai_quan_he, hieu_luc)
OVERRIDING SYSTEM VALUE
VALUES
  -- Đời 1: vợ chồng
  (1,  1, 2, 'VO_CHONG', true),
  -- Đời 1 → Đời 2
  (2,  1, 3, 'CHA_CON', true),
  (3,  2, 3, 'ME_CON',  true),
  (4,  1, 5, 'CHA_CON', true),
  (5,  2, 5, 'ME_CON',  true),
  -- Đời 2: vợ chồng
  (6,  3, 4, 'VO_CHONG', true),
  -- Đời 2 → Đời 3
  (7,  3, 6, 'CHA_CON', true),
  (8,  4, 6, 'ME_CON',  true),
  (9,  3, 7, 'CHA_CON', true),
  (10, 4, 7, 'ME_CON',  true);

-- ============================================================
-- 9. CẤU HÌNH QUYỀN RIÊNG TƯ
-- ============================================================
INSERT INTO cau_hinh_rieng_tu (id, ho_so_id, truong, pham_vi)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 3, 'SO_DIEN_THOAI', 'TOAN_HO'),
  (2, 6, 'SO_DIEN_THOAI', 'TRONG_CHI'),
  (3, 7, 'EMAIL',         'CHI_TOI');

-- ============================================================
-- 10. BẢNG TIN & TƯƠNG TÁC
-- ============================================================
INSERT INTO bai_viet
  (id, tai_khoan_id, dong_ho_id, chi_id, noi_dung, pham_vi, chuyen_muc, trang_thai, ghim)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, 1, NULL,
   'Kính báo toàn thể con cháu dòng họ: Công trình trùng tu mái ngói và cổng Từ Đường Dòng Họ đã hoàn tất tốt đẹp trước ngày giỗ tổ.',
   'TOAN_HO', 'GOC_HOAI_NIEM', 'DA_XUAT_BAN', true),
  (2, 3, 1, 1,
   'Chia sẻ cùng bà con trong Chi Trưởng: Cháu Nguyễn Phúc Dung đã bảo vệ xuất sắc luận án Thạc sĩ tại Đại học Quốc gia!',
   'TOAN_HO', 'KHUYEN_HOC_THANH_TICH', 'DA_XUAT_BAN', false);

INSERT INTO tep_dinh_kem
  (id, bai_viet_id, yeu_cau_cap_nhat_id, yeu_cau_gia_nhap_id,
   tai_khoan_tai_len_id, ten_tep, loai_tep, dung_luong, duong_dan_luu)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, NULL, NULL, 1,
   'nha_tho_to_hoan_thanh.jpg', 'image/jpeg', 2048576,
   'https://storage.giapha.vn/media/2026/tu_duong_1.jpg');

INSERT INTO binh_luan (id, bai_viet_id, tai_khoan_id, noi_dung, trang_thai)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, 2, 'Hoan hỉ và cảm ơn Bác Trưởng họ cùng ban kiến thiết đã dốc sức vì việc họ.', 'HIEN_THI'),
  (2, 2, 1, 'Bác chúc mừng cháu Dung đã làm rạng danh dòng họ!', 'HIEN_THI');

INSERT INTO cam_xuc (id, bai_viet_id, tai_khoan_id, loai)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, 2, 'THICH'),
  (2, 1, 3, 'TIM'),
  (3, 2, 1, 'TIM'),
  (4, 2, 2, 'THICH');

-- ============================================================
-- 11. SỰ KIỆN & LỊCH GIỖ
-- ============================================================
INSERT INTO su_kien
  (id, dong_ho_id, chi_id, ho_so_id, ten, ngay_goc, loai_lich,
   ngay_duong, dia_diem, pham_vi, loai_su_kien)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, NULL, 1,
   'Lễ Giỗ Cụ Thủy Tổ Nguyễn Phúc Khởi',
   '2000-08-15', 'AM', '2026-09-25',
   'Từ Đường Dòng Họ, Thừa Thiên Huế', 'TOAN_HO', 'LICH_GIO'),
  (2, 1, NULL, NULL,
   'Hội Nghị Khuyến Học & Tất Niên 2026',
   '2026-12-28', 'DUONG', '2026-12-28',
   'Nhà Văn Hóa Dòng Họ', 'TOAN_HO', 'SU_KIEN_THUONG');

-- ============================================================
-- 12. THÔNG BÁO HỆ THỐNG
-- ============================================================
INSERT INTO thong_bao
  (id, tai_khoan_id, su_kien_id, loai, noi_dung, da_doc, trang_thai_gui)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 2, 1, 'NHAC_SU_KIEN',
   'Sắp tới ngày 15/08 Âm lịch là Lễ Giỗ Cụ Thủy Tổ, kính mời quý chi sắp xếp về dự lễ.',
   false, 'DA_GUI'),
  (2, 3, 1, 'NHAC_SU_KIEN',
   'Sắp tới ngày 15/08 Âm lịch là Lễ Giỗ Cụ Thủy Tổ, kính mời quý chi sắp xếp về dự lễ.',
   true, 'DA_GUI');

-- ============================================================
-- 13. BẦU CHỌN TRƯỞNG HỌ (đã kết thúc)
-- ============================================================
INSERT INTO phien_chon_truong_ho
  (id, dong_ho_id, trang_thai, bat_dau_luc, ket_thuc_luc,
   ung_vien_duoc_chon_id, nguoi_xac_nhan_id, ghi_chu_ket_qua)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, 'DA_KET_THUC',
   '2026-01-01 08:00:00+07', '2026-01-15 17:00:00+07',
   3, 1, 'Tín nhiệm Bác Nguyễn Phúc An tiếp tục giữ vai trò Trưởng họ');

INSERT INTO phieu_bau_truong_ho
  (id, phien_id, dong_ho_id, chi_id, truong_chi_tai_khoan_id,
   ung_vien_ho_so_id, lua_chon, ly_do)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, 1, 2, 2, 3, 'DONG_Y', 'Bác An uy tín và gương mẫu');

-- ============================================================
-- 14. QUỸ, ĐỢT ĐÓNG GÓP & GIAO DỊCH (dùng để kiểm tra view v_so_du_quy)
--     Quỹ 1: số dư đầu kỳ 10.000.000
--       + THU 5.000.000 (từ yêu cầu đóng góp id=1)
--       - CHI 3.000.000
--     → Kỳ vọng v_so_du_quy: 12.000.000
-- ============================================================
INSERT INTO quy (id, dong_ho_id, chi_id, ten, cap_quy, so_du_dau_ky)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, NULL, 'Quỹ Khuyến Học Dòng Họ Nguyễn Phúc', 'TOAN_HO', 10000000),
  (2, 1, NULL, 'Quỹ Trùng Tu Từ Đường Dòng Họ',       'TOAN_HO', 50000000);

INSERT INTO dot_dong_gop (id, quy_id, ten, muc_dich, bat_dau, ket_thuc)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1,
   'Đợt Vận Động Khuyến Học Năm Học 2026–2027',
   'Học bổng cho các cháu đỗ đại học và vượt khó học giỏi',
   '2026-09-01', '2026-11-30');

INSERT INTO yeu_cau_dong_gop
  (id, dot_dong_gop_id, tai_khoan_id, so_tien, thoi_diem_chuyen, trang_thai)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, 3, 5000000, '2026-10-01 10:30:00+07', 'DA_XAC_NHAN');

INSERT INTO giao_dich_quy
  (id, quy_id, yeu_cau_dong_gop_id, loai, so_tien, ngay, noi_dung)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, 1, 'THU', 5000000, '2026-10-01',
   'Thu tiền ủng hộ quỹ khuyến học từ anh Cường'),
  (2, 1, NULL, 'CHI', 3000000, '2026-10-15',
   'Chi khen thưởng học bổng cho các cháu học sinh giỏi');

INSERT INTO chung_tu
  (id, giao_dich_quy_id, yeu_cau_dong_gop_id, ten_tep, loai_tep, duong_dan_luu)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, NULL,
   'bien_lai_thu_001.pdf', 'application/pdf',
   'https://storage.giapha.vn/chung_tu/2026/bl_001.pdf'),
  (2, NULL, 1,
   'sao_ke_ck_anh_cuong.png', 'image/png',
   'https://storage.giapha.vn/chung_tu/2026/sk_cuong.png');

-- ============================================================
-- ĐỒNG BỘ SEQUENCE SAU KHI CHÈN DỮ LIỆU CÓ ID TƯỜNG MINH
-- setval(seq, max_id) — insert tiếp theo sẽ dùng max_id + 1
-- ============================================================
SELECT setval(pg_get_serial_sequence('dong_ho',            'id'), MAX(id)) FROM dong_ho;
SELECT setval(pg_get_serial_sequence('chi',                'id'), MAX(id)) FROM chi;
SELECT setval(pg_get_serial_sequence('ho_so_thanh_vien',   'id'), MAX(id)) FROM ho_so_thanh_vien;
SELECT setval(pg_get_serial_sequence('tai_khoan',          'id'), MAX(id)) FROM tai_khoan;
SELECT setval(pg_get_serial_sequence('xac_thuc_totp',      'id'), MAX(id)) FROM xac_thuc_totp;
SELECT setval(pg_get_serial_sequence('tai_khoan_ho_so',    'id'), MAX(id)) FROM tai_khoan_ho_so;
SELECT setval(pg_get_serial_sequence('vai_tro_phan_quyen', 'id'), MAX(id)) FROM vai_tro_phan_quyen;
SELECT setval(pg_get_serial_sequence('quan_he_pha_he',     'id'), MAX(id)) FROM quan_he_pha_he;
SELECT setval(pg_get_serial_sequence('cau_hinh_rieng_tu',  'id'), MAX(id)) FROM cau_hinh_rieng_tu;
SELECT setval(pg_get_serial_sequence('bai_viet',           'id'), MAX(id)) FROM bai_viet;
SELECT setval(pg_get_serial_sequence('tep_dinh_kem',       'id'), MAX(id)) FROM tep_dinh_kem;
SELECT setval(pg_get_serial_sequence('binh_luan',          'id'), MAX(id)) FROM binh_luan;
SELECT setval(pg_get_serial_sequence('cam_xuc',            'id'), MAX(id)) FROM cam_xuc;
SELECT setval(pg_get_serial_sequence('su_kien',            'id'), MAX(id)) FROM su_kien;
SELECT setval(pg_get_serial_sequence('thong_bao',          'id'), MAX(id)) FROM thong_bao;
SELECT setval(pg_get_serial_sequence('phien_chon_truong_ho','id'), MAX(id)) FROM phien_chon_truong_ho;
SELECT setval(pg_get_serial_sequence('phieu_bau_truong_ho','id'), MAX(id)) FROM phieu_bau_truong_ho;
SELECT setval(pg_get_serial_sequence('quy',                'id'), MAX(id)) FROM quy;
SELECT setval(pg_get_serial_sequence('dot_dong_gop',       'id'), MAX(id)) FROM dot_dong_gop;
SELECT setval(pg_get_serial_sequence('yeu_cau_dong_gop',   'id'), MAX(id)) FROM yeu_cau_dong_gop;
SELECT setval(pg_get_serial_sequence('giao_dich_quy',      'id'), MAX(id)) FROM giao_dich_quy;
SELECT setval(pg_get_serial_sequence('chung_tu',           'id'), MAX(id)) FROM chung_tu;

COMMIT;

-- Kiểm tra nhanh sau khi seed
DO $$
DECLARE
  so_du NUMERIC;
BEGIN
  SELECT so_du INTO so_du FROM v_so_du_quy WHERE quy_id = 1;
  IF so_du <> 12000000 THEN
    RAISE EXCEPTION 'Kiểm tra seed thất bại: v_so_du_quy quy_id=1 kỳ vọng 12000000, thực tế %', so_du;
  END IF;
  RAISE NOTICE 'Seed thành công. v_so_du_quy(id=1) = %', so_du;
END $$;
