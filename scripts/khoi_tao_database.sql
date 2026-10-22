/*
================================================================================
KỊCH BẢN KHỞI TẠO CƠ SỞ DỮ LIỆU VÀ DỮ LIỆU MẪU (SEED DATA)
Dự án: Mạng xã hội Cây gia phả (Social Media Family Tree)
Phiên bản CSDL: 1.2 (Khớp 100% với Báo cáo CSDL v1.2)
Bao gồm:
  - 28 bảng nghiệp vụ + 1 bảng xác thực bảo mật TOTP = 29 BẢNG
  - 2 Business VIEWs: v_so_du_quy, v_tuong_tac_bai_viet
  - Business TRIGGERS & Ràng buộc toàn vẹn
  - Bộ DỮ LIỆU MẪU 3 THẾ HỆ (Seed Data) sinh động, trực quan
Hệ quản trị CSDL tương thích: PostgreSQL 16+

HƯỚNG DẪN SỬ DỤNG:
- Cách 1 (DBeaver / DataGrip / pgAdmin):
    Mở file này, chọn database 'giapha' và chạy toàn bộ (Run Script / F5 / Alt+X).
- Cách 2 (Dùng script tiện ích đi kèm):
    Trên Windows:     .\scripts\chay_khoi_tao_db.ps1
    Trên Linux/macOS: ./scripts/chay_khoi_tao_db.sh
- Cách 3 (Lệnh Docker trực tiếp):
    docker compose exec -T db psql -U root -d giapha -f /docker-entrypoint-initdb.d/khoi_tao_database.sql
    (hoặc pipe file: Get-Content scripts/khoi_tao_database.sql -Raw | docker compose exec -T db psql -U root -d giapha)
================================================================================
*/

BEGIN;

-- 1. Bật extension mở rộng cần thiết
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Tạo và cấu hình Schema gia_pha
CREATE SCHEMA IF NOT EXISTS gia_pha;
SET LOCAL search_path TO gia_pha, public;

DO $$ BEGIN CREATE TYPE trang_thai_tai_khoan AS ENUM ('HOAT_DONG','BI_KHOA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE loai_xac_thuc AS ENUM ('NOI_BO','GOOGLE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE loai_vai_tro AS ENUM ('THANH_VIEN','TRUONG_CHI','TRUONG_HO','KY_THUAT_VIEN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE pham_vi_vai_tro AS ENUM ('TOAN_HO','CHI'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE trang_thai_dong_ho AS ENUM ('CHUA_KHOI_TAO','DANG_HOAT_DONG'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE gioi_tinh AS ENUM ('NAM','NU','KHAC'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE loai_lich AS ENUM ('AM','DUONG'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE trang_thai_ho_so AS ENUM ('DANG_SONG','DA_MAT','KHUYET_DANH'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE loai_quan_he AS ENUM ('CHA_CON','ME_CON','VO_CHONG'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE trang_thai_yeu_cau AS ENUM ('CHO_DUYET','CHO_BO_SUNG','DA_DUYET','BI_TU_CHOI','DA_HUY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE loai_tham_chieu_gia_nhap AS ENUM ('MA_GIA_PHA','MA_TAI_KHOAN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE trang_thai_loi_moi AS ENUM ('CHO_XAC_NHAN','DA_CHAP_NHAN','DA_TU_CHOI','HET_HAN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE loai_yeu_cau_cap_nhat AS ENUM ('THEM_HO_SO','SUA_HO_SO','THEM_QUAN_HE','SUA_QUAN_HE','KET_THUC_QUAN_HE','QUA_DOI','XOA_MEM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE quyet_dinh AS ENUM ('DUYET','TU_CHOI'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE pham_vi_hien_thi AS ENUM ('CHI_TOI','TRONG_CHI','TOAN_HO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE truong_rieng_tu AS ENUM ('SO_DIEN_THOAI','EMAIL','DIA_CHI','QUE_QUAN','NGAY_SINH','TIEU_SU','ANH_DAI_DIEN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE pham_vi_bai_viet AS ENUM ('TOAN_HO','TRONG_CHI'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE chuyen_muc AS ENUM ('BAO_HY','TIN_BUON','KY_NIEM_GIA_DINH','KHUYEN_HOC_THANH_TICH','GOC_HOAI_NIEM'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE trang_thai_bai_viet AS ENUM ('DA_XUAT_BAN','DA_AN','DA_XOA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE trang_thai_binh_luan AS ENUM ('HIEN_THI','DA_XOA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE loai_su_kien AS ENUM ('SU_KIEN_THUONG','LICH_GIO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE loai_thong_bao AS ENUM ('NHAC_SU_KIEN','LOI_MOI','YEU_CAU_GIA_NHAP','YEU_CAU_CAP_NHAT','KET_QUA_XU_LY','YEU_CAU_BO_SUNG'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE trang_thai_gui AS ENUM ('CHO_GUI','DA_GUI','LOI'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE trang_thai_bau AS ENUM ('DANG_MO','DA_KET_THUC','DA_HUY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE lua_chon_bau AS ENUM ('DONG_Y','KHONG_DONG_Y','BO_PHIEU_TRANG'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE cap_quy AS ENUM ('TOAN_HO','CHI'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE trang_thai_dong_gop AS ENUM ('CHO_DUYET','DA_XAC_NHAN','BI_TU_CHOI'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE loai_giao_dich AS ENUM ('THU','CHI'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS dong_ho (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  ma_gia_pha VARCHAR(32) NOT NULL UNIQUE,
  ten VARCHAR(200) NOT NULL,
  trang_thai trang_thai_dong_ho NOT NULL DEFAULT 'CHUA_KHOI_TAO',
  ho_so_goc_id BIGINT,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chi (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  dong_ho_id BIGINT NOT NULL REFERENCES dong_ho(id) ON DELETE RESTRICT,
  ten_chi VARCHAR(200) NOT NULL,
  ho_so_truong_chi_id BIGINT,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dong_ho_id, ten_chi), UNIQUE (id, dong_ho_id)
);

CREATE TABLE IF NOT EXISTS ho_so_thanh_vien (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  dong_ho_id BIGINT NOT NULL REFERENCES dong_ho(id) ON DELETE RESTRICT,
  chi_id BIGINT,
  ma_thanh_vien VARCHAR(32) NOT NULL,
  ho_ten VARCHAR(200) NOT NULL,
  gioi_tinh gioi_tinh,
  ngay_sinh DATE,
  ngay_mat DATE,
  loai_lich_ngay_mat loai_lich,
  so_dien_thoai VARCHAR(16), dia_chi VARCHAR(500), que_quan VARCHAR(300),
  noi_an_tang VARCHAR(300), tieu_su TEXT, anh_dai_dien TEXT,
  the_he INTEGER CHECK (the_he IS NULL OR the_he >= 1),
  trang_thai trang_thai_ho_so NOT NULL DEFAULT 'DANG_SONG',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dong_ho_id, ma_thanh_vien), UNIQUE (id, dong_ho_id), UNIQUE (id, dong_ho_id, chi_id),
  FOREIGN KEY (chi_id, dong_ho_id) REFERENCES chi(id, dong_ho_id) ON DELETE RESTRICT,
  CHECK (ngay_mat IS NULL OR ngay_sinh IS NULL OR ngay_mat >= ngay_sinh),
  CHECK (ngay_mat IS NULL OR trang_thai <> 'DANG_SONG'),
  CHECK ((ngay_mat IS NULL) = (loai_lich_ngay_mat IS NULL))
);

DO $$ BEGIN
  ALTER TABLE dong_ho ADD CONSTRAINT fk_dong_ho_ho_so_goc
    FOREIGN KEY (ho_so_goc_id, id) REFERENCES ho_so_thanh_vien(id, dong_ho_id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tai_khoan (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  ma_tai_khoan VARCHAR(32) NOT NULL UNIQUE,
  so_dien_thoai VARCHAR(16) NOT NULL UNIQUE CHECK (so_dien_thoai ~ '^\+[1-9][0-9]{7,14}$'),
  email VARCHAR(254),
  mat_khau_hash TEXT,
  loai_xac_thuc loai_xac_thuc NOT NULL DEFAULT 'NOI_BO',
  google_sub VARCHAR(255) UNIQUE,
  trang_thai trang_thai_tai_khoan NOT NULL DEFAULT 'HOAT_DONG',
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (loai_xac_thuc = 'NOI_BO' AND mat_khau_hash IS NOT NULL AND google_sub IS NULL) OR
    (loai_xac_thuc = 'GOOGLE' AND mat_khau_hash IS NULL AND google_sub IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tai_khoan_email_ci ON tai_khoan (lower(email)) WHERE email IS NOT NULL;

-- Bang bao mat xac thuc TOTP (Google Authenticator) rieng biet theo kien nghi muc 6.2 Bao cao
CREATE TABLE IF NOT EXISTS xac_thuc_totp (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tai_khoan_id BIGINT NOT NULL UNIQUE REFERENCES tai_khoan(id) ON DELETE CASCADE,
  khoa_bi_mat_ma_hoa TEXT NOT NULL,
  da_kich_hoat BOOLEAN NOT NULL DEFAULT false,
  buoc_thoi_gian_cuoi BIGINT,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- Mot tai khoan co the tham gia nhieu dong ho; moi ho so chi co mot tai khoan chu.
CREATE TABLE IF NOT EXISTS tai_khoan_ho_so (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tai_khoan_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  dong_ho_id BIGINT NOT NULL REFERENCES dong_ho(id) ON DELETE RESTRICT,
  ho_so_id BIGINT NOT NULL,
  lien_ket_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tai_khoan_id, dong_ho_id), UNIQUE (ho_so_id),
  FOREIGN KEY (ho_so_id, dong_ho_id) REFERENCES ho_so_thanh_vien(id, dong_ho_id) ON DELETE RESTRICT
);

DO $$ BEGIN
  ALTER TABLE chi ADD CONSTRAINT fk_chi_truong_chi_cung_chi
    FOREIGN KEY (ho_so_truong_chi_id, dong_ho_id, id)
    REFERENCES ho_so_thanh_vien(id, dong_ho_id, chi_id) ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS vai_tro_phan_quyen (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tai_khoan_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  loai_vai_tro loai_vai_tro NOT NULL,
  pham_vi pham_vi_vai_tro NOT NULL,
  dong_ho_id BIGINT REFERENCES dong_ho(id) ON DELETE RESTRICT,
  chi_id BIGINT REFERENCES chi(id) ON DELETE RESTRICT,
  hieu_luc_tu DATE NOT NULL DEFAULT CURRENT_DATE, hieu_luc_den DATE,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (hieu_luc_den IS NULL OR hieu_luc_den >= hieu_luc_tu),
  CHECK ((pham_vi='TOAN_HO' AND dong_ho_id IS NOT NULL AND chi_id IS NULL)
      OR (pham_vi='CHI' AND chi_id IS NOT NULL AND dong_ho_id IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_truong_ho_hien_hanh ON vai_tro_phan_quyen(dong_ho_id)
  WHERE loai_vai_tro='TRUONG_HO' AND pham_vi='TOAN_HO' AND hieu_luc_den IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_truong_chi_hien_hanh ON vai_tro_phan_quyen(chi_id)
  WHERE loai_vai_tro='TRUONG_CHI' AND pham_vi='CHI' AND hieu_luc_den IS NULL;
CREATE INDEX IF NOT EXISTS idx_vai_tro_tai_khoan ON vai_tro_phan_quyen(tai_khoan_id);

CREATE TABLE IF NOT EXISTS quan_he_pha_he (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tu_ho_so_id BIGINT NOT NULL REFERENCES ho_so_thanh_vien(id) ON DELETE RESTRICT,
  den_ho_so_id BIGINT NOT NULL REFERENCES ho_so_thanh_vien(id) ON DELETE RESTRICT,
  loai_quan_he loai_quan_he NOT NULL,
  hieu_luc BOOLEAN NOT NULL DEFAULT true,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (tu_ho_so_id <> den_ho_so_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_quan_he_cha_con_hien_luc ON quan_he_pha_he(tu_ho_so_id,den_ho_so_id,loai_quan_he)
  WHERE hieu_luc AND loai_quan_he IN ('CHA_CON','ME_CON');
CREATE UNIQUE INDEX IF NOT EXISTS uq_quan_he_vo_chong_hien_luc ON quan_he_pha_he
  (LEAST(tu_ho_so_id,den_ho_so_id), GREATEST(tu_ho_so_id,den_ho_so_id))
  WHERE hieu_luc AND loai_quan_he='VO_CHONG';
CREATE INDEX IF NOT EXISTS idx_qh_tu ON quan_he_pha_he(tu_ho_so_id) WHERE hieu_luc;
CREATE INDEX IF NOT EXISTS idx_qh_den ON quan_he_pha_he(den_ho_so_id) WHERE hieu_luc;

CREATE TABLE IF NOT EXISTS cau_hinh_rieng_tu (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  ho_so_id BIGINT NOT NULL REFERENCES ho_so_thanh_vien(id) ON DELETE CASCADE,
  truong truong_rieng_tu NOT NULL,
  pham_vi pham_vi_hien_thi NOT NULL DEFAULT 'TRONG_CHI',
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ho_so_id, truong)
);

CREATE TABLE IF NOT EXISTS yeu_cau_gia_nhap (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tai_khoan_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  dong_ho_id BIGINT NOT NULL REFERENCES dong_ho(id) ON DELETE RESTRICT,
  loai_tham_chieu loai_tham_chieu_gia_nhap NOT NULL,
  ma_tham_chieu_nhap VARCHAR(64) NOT NULL,
  ho_so_tham_chieu_id BIGINT,
  quan_he_de_nghi VARCHAR(200) NOT NULL,
  ho_ten_de_nghi VARCHAR(200) NOT NULL,
  ngay_sinh_de_nghi DATE,
  nguoi_duyet_du_kien_id BIGINT REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  trang_thai trang_thai_yeu_cau NOT NULL DEFAULT 'CHO_DUYET',
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (ho_so_tham_chieu_id, dong_ho_id) REFERENCES ho_so_thanh_vien(id,dong_ho_id) ON DELETE RESTRICT,
  CHECK ((loai_tham_chieu='MA_GIA_PHA' AND ho_so_tham_chieu_id IS NULL)
      OR (loai_tham_chieu='MA_TAI_KHOAN' AND ho_so_tham_chieu_id IS NOT NULL)),
  CHECK (nguoi_duyet_du_kien_id IS NULL OR nguoi_duyet_du_kien_id <> tai_khoan_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ycgn_cho_duyet ON yeu_cau_gia_nhap(tai_khoan_id,dong_ho_id)
  WHERE trang_thai IN ('CHO_DUYET','CHO_BO_SUNG');
CREATE INDEX IF NOT EXISTS idx_ycgn_nguoi_duyet ON yeu_cau_gia_nhap(nguoi_duyet_du_kien_id,trang_thai);

CREATE TABLE IF NOT EXISTS loi_moi_gia_nhap (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tai_khoan_nhan_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  tai_khoan_gui_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  dong_ho_id BIGINT NOT NULL REFERENCES dong_ho(id) ON DELETE RESTRICT,
  ho_so_id BIGINT NOT NULL,
  vai_ve_de_nghi VARCHAR(200) NOT NULL,
  trang_thai trang_thai_loi_moi NOT NULL DEFAULT 'CHO_XAC_NHAN',
  het_han_luc TIMESTAMPTZ,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (tai_khoan_nhan_id <> tai_khoan_gui_id),
  FOREIGN KEY (ho_so_id,dong_ho_id) REFERENCES ho_so_thanh_vien(id,dong_ho_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_loi_moi_cho_xac_nhan ON loi_moi_gia_nhap(tai_khoan_nhan_id,ho_so_id)
  WHERE trang_thai='CHO_XAC_NHAN';

CREATE TABLE IF NOT EXISTS yeu_cau_cap_nhat_pha_he (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  dong_ho_id BIGINT NOT NULL REFERENCES dong_ho(id) ON DELETE RESTRICT,
  tai_khoan_tao_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  ho_so_id BIGINT NOT NULL,
  nguoi_duyet_du_kien_id BIGINT REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  loai loai_yeu_cau_cap_nhat NOT NULL,
  du_lieu_truoc JSONB,
  du_lieu_de_nghi JSONB NOT NULL,
  version_co_so INTEGER,
  ly_do VARCHAR(1000) NOT NULL CHECK (length(btrim(ly_do))>0),
  trang_thai trang_thai_yeu_cau NOT NULL DEFAULT 'CHO_DUYET',
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (ho_so_id,dong_ho_id) REFERENCES ho_so_thanh_vien(id,dong_ho_id) ON DELETE RESTRICT,
  CHECK (nguoi_duyet_du_kien_id IS NULL OR nguoi_duyet_du_kien_id <> tai_khoan_tao_id)
);
CREATE INDEX IF NOT EXISTS idx_yccn_nguoi_duyet ON yeu_cau_cap_nhat_pha_he(nguoi_duyet_du_kien_id,trang_thai);
CREATE INDEX IF NOT EXISTS idx_yccn_hoso ON yeu_cau_cap_nhat_pha_he(ho_so_id,trang_thai);

CREATE TABLE IF NOT EXISTS trao_doi_yeu_cau (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  yeu_cau_cap_nhat_id BIGINT NOT NULL REFERENCES yeu_cau_cap_nhat_pha_he(id) ON DELETE RESTRICT,
  tai_khoan_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  noi_dung TEXT NOT NULL CHECK (length(btrim(noi_dung))>0),
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quyet_dinh_duyet (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  yeu_cau_gia_nhap_id BIGINT UNIQUE REFERENCES yeu_cau_gia_nhap(id) ON DELETE RESTRICT,
  yeu_cau_cap_nhat_id BIGINT UNIQUE REFERENCES yeu_cau_cap_nhat_pha_he(id) ON DELETE RESTRICT,
  nguoi_duyet_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  quyet_dinh quyet_dinh NOT NULL,
  ly_do VARCHAR(1000), thoi_diem TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(yeu_cau_gia_nhap_id,yeu_cau_cap_nhat_id)=1),
  CHECK (quyet_dinh <> 'TU_CHOI' OR (ly_do IS NOT NULL AND length(btrim(ly_do))>0))
);

CREATE TABLE IF NOT EXISTS nhat_ky_thay_doi (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  doi_tuong VARCHAR(100) NOT NULL,
  doi_tuong_id BIGINT NOT NULL,
  truoc JSONB, sau JSONB,
  nguoi_thuc_hien_id BIGINT REFERENCES tai_khoan(id) ON DELETE SET NULL,
  thoi_diem TIMESTAMPTZ NOT NULL DEFAULT now(), ly_do VARCHAR(1000)
);
CREATE INDEX IF NOT EXISTS idx_nhat_ky_doi_tuong ON nhat_ky_thay_doi(doi_tuong,doi_tuong_id,thoi_diem);

CREATE TABLE IF NOT EXISTS bai_viet (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tai_khoan_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  dong_ho_id BIGINT NOT NULL REFERENCES dong_ho(id) ON DELETE RESTRICT,
  chi_id BIGINT,
  noi_dung TEXT NOT NULL CHECK (length(btrim(noi_dung))>0),
  pham_vi pham_vi_bai_viet NOT NULL, chuyen_muc chuyen_muc NOT NULL,
  trang_thai trang_thai_bai_viet NOT NULL DEFAULT 'DA_XUAT_BAN',
  ghim BOOLEAN NOT NULL DEFAULT false,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (chi_id,dong_ho_id) REFERENCES chi(id,dong_ho_id) ON DELETE RESTRICT,
  CHECK (pham_vi <> 'TRONG_CHI' OR chi_id IS NOT NULL),
  CHECK (NOT ghim OR trang_thai='DA_XUAT_BAN')
);
CREATE INDEX IF NOT EXISTS idx_bai_viet_bang_tin ON bai_viet(dong_ho_id,pham_vi,tao_luc DESC);

CREATE TABLE IF NOT EXISTS tep_dinh_kem (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  bai_viet_id BIGINT REFERENCES bai_viet(id) ON DELETE RESTRICT,
  yeu_cau_cap_nhat_id BIGINT REFERENCES yeu_cau_cap_nhat_pha_he(id) ON DELETE RESTRICT,
  yeu_cau_gia_nhap_id BIGINT REFERENCES yeu_cau_gia_nhap(id) ON DELETE RESTRICT,
  tai_khoan_tai_len_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  ten_tep VARCHAR(255) NOT NULL, loai_tep VARCHAR(100) NOT NULL,
  dung_luong BIGINT NOT NULL CHECK (dung_luong>0), duong_dan_luu TEXT NOT NULL,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(bai_viet_id,yeu_cau_cap_nhat_id,yeu_cau_gia_nhap_id)=1)
);

CREATE TABLE IF NOT EXISTS binh_luan (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  bai_viet_id BIGINT NOT NULL REFERENCES bai_viet(id) ON DELETE RESTRICT,
  tai_khoan_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  noi_dung TEXT NOT NULL CHECK (length(btrim(noi_dung))>0),
  trang_thai trang_thai_binh_luan NOT NULL DEFAULT 'HIEN_THI',
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_binh_luan_bai_viet ON binh_luan(bai_viet_id,tao_luc);

CREATE TABLE IF NOT EXISTS cam_xuc (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  bai_viet_id BIGINT NOT NULL REFERENCES bai_viet(id) ON DELETE RESTRICT,
  tai_khoan_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  loai VARCHAR(30) NOT NULL,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bai_viet_id,tai_khoan_id)
);

CREATE TABLE IF NOT EXISTS su_kien (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  dong_ho_id BIGINT NOT NULL REFERENCES dong_ho(id) ON DELETE RESTRICT,
  chi_id BIGINT, ho_so_id BIGINT,
  ten VARCHAR(300) NOT NULL, ngay_goc DATE NOT NULL, loai_lich loai_lich NOT NULL,
  ngay_duong DATE NOT NULL, dia_diem VARCHAR(300), pham_vi pham_vi_bai_viet NOT NULL DEFAULT 'TOAN_HO',
  loai_su_kien loai_su_kien NOT NULL DEFAULT 'SU_KIEN_THUONG',
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (chi_id,dong_ho_id) REFERENCES chi(id,dong_ho_id) ON DELETE RESTRICT,
  FOREIGN KEY (ho_so_id,dong_ho_id) REFERENCES ho_so_thanh_vien(id,dong_ho_id) ON DELETE RESTRICT,
  CHECK (loai_su_kien <> 'LICH_GIO' OR ho_so_id IS NOT NULL),
  CHECK (pham_vi <> 'TRONG_CHI' OR chi_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_su_kien_ngay_duong ON su_kien(ngay_duong);

CREATE TABLE IF NOT EXISTS thong_bao (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tai_khoan_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  su_kien_id BIGINT REFERENCES su_kien(id) ON DELETE RESTRICT,
  yeu_cau_gia_nhap_id BIGINT REFERENCES yeu_cau_gia_nhap(id) ON DELETE RESTRICT,
  yeu_cau_cap_nhat_id BIGINT REFERENCES yeu_cau_cap_nhat_pha_he(id) ON DELETE RESTRICT,
  loai loai_thong_bao NOT NULL, noi_dung VARCHAR(1000) NOT NULL,
  da_doc BOOLEAN NOT NULL DEFAULT false, trang_thai_gui trang_thai_gui NOT NULL DEFAULT 'CHO_GUI',
  so_lan_thu INTEGER NOT NULL DEFAULT 0 CHECK (so_lan_thu>=0), lan_thu_tiep_theo TIMESTAMPTZ,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(su_kien_id,yeu_cau_gia_nhap_id,yeu_cau_cap_nhat_id)<=1)
);
CREATE INDEX IF NOT EXISTS idx_thong_bao_hang_doi ON thong_bao(trang_thai_gui,lan_thu_tiep_theo);
CREATE INDEX IF NOT EXISTS idx_thong_bao_tai_khoan ON thong_bao(tai_khoan_id,da_doc,tao_luc DESC);

CREATE TABLE IF NOT EXISTS phien_chon_truong_ho (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  dong_ho_id BIGINT NOT NULL REFERENCES dong_ho(id) ON DELETE RESTRICT,
  trang_thai trang_thai_bau NOT NULL DEFAULT 'DANG_MO',
  bat_dau_luc TIMESTAMPTZ NOT NULL DEFAULT now(), ket_thuc_luc TIMESTAMPTZ,
  ung_vien_duoc_chon_id BIGINT,
  nguoi_xac_nhan_id BIGINT REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  ghi_chu_ket_qua TEXT,
  FOREIGN KEY (ung_vien_duoc_chon_id,dong_ho_id) REFERENCES ho_so_thanh_vien(id,dong_ho_id) ON DELETE RESTRICT,
  UNIQUE (id,dong_ho_id),
  CHECK ((trang_thai='DANG_MO' AND ket_thuc_luc IS NULL) OR trang_thai<>'DANG_MO')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_phien_bau_dang_mo ON phien_chon_truong_ho(dong_ho_id) WHERE trang_thai='DANG_MO';

CREATE TABLE IF NOT EXISTS phieu_bau_truong_ho (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  phien_id BIGINT NOT NULL REFERENCES phien_chon_truong_ho(id) ON DELETE RESTRICT,
  dong_ho_id BIGINT NOT NULL REFERENCES dong_ho(id) ON DELETE RESTRICT,
  chi_id BIGINT NOT NULL REFERENCES chi(id) ON DELETE RESTRICT,
  truong_chi_tai_khoan_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  ung_vien_ho_so_id BIGINT,
  lua_chon lua_chon_bau NOT NULL,
  ly_do VARCHAR(1000), tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (phien_id,dong_ho_id) REFERENCES phien_chon_truong_ho(id,dong_ho_id) ON DELETE RESTRICT,
  FOREIGN KEY (chi_id,dong_ho_id) REFERENCES chi(id,dong_ho_id) ON DELETE RESTRICT,
  FOREIGN KEY (ung_vien_ho_so_id,dong_ho_id) REFERENCES ho_so_thanh_vien(id,dong_ho_id) ON DELETE RESTRICT,
  UNIQUE (phien_id,chi_id),
  CHECK ((lua_chon='DONG_Y' AND ung_vien_ho_so_id IS NOT NULL) OR lua_chon<>'DONG_Y')
);

CREATE TABLE IF NOT EXISTS yeu_cau_khoi_phuc_mat_khau (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tai_khoan_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL UNIQUE,
  het_han_luc TIMESTAMPTZ NOT NULL,
  da_su_dung_luc TIMESTAMPTZ,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (het_han_luc>tao_luc)
);
CREATE INDEX IF NOT EXISTS idx_khoi_phuc_tai_khoan ON yeu_cau_khoi_phuc_mat_khau(tai_khoan_id,het_han_luc);

CREATE TABLE IF NOT EXISTS quy (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  dong_ho_id BIGINT REFERENCES dong_ho(id) ON DELETE RESTRICT,
  chi_id BIGINT REFERENCES chi(id) ON DELETE RESTRICT,
  ten VARCHAR(200) NOT NULL, cap_quy cap_quy NOT NULL,
  so_du_dau_ky NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (so_du_dau_ky>=0),
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((cap_quy='TOAN_HO' AND dong_ho_id IS NOT NULL AND chi_id IS NULL)
      OR (cap_quy='CHI' AND chi_id IS NOT NULL AND dong_ho_id IS NULL))
);

CREATE TABLE IF NOT EXISTS dot_dong_gop (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  quy_id BIGINT NOT NULL REFERENCES quy(id) ON DELETE RESTRICT,
  ten VARCHAR(200) NOT NULL, muc_dich VARCHAR(500), bat_dau DATE NOT NULL, ket_thuc DATE,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ket_thuc IS NULL OR ket_thuc>=bat_dau)
);

CREATE TABLE IF NOT EXISTS yeu_cau_dong_gop (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  dot_dong_gop_id BIGINT NOT NULL REFERENCES dot_dong_gop(id) ON DELETE RESTRICT,
  tai_khoan_id BIGINT NOT NULL REFERENCES tai_khoan(id) ON DELETE RESTRICT,
  so_tien NUMERIC(15,2) NOT NULL CHECK (so_tien>0), thoi_diem_chuyen TIMESTAMPTZ NOT NULL,
  trang_thai trang_thai_dong_gop NOT NULL DEFAULT 'CHO_DUYET', ly_do_tu_choi VARCHAR(1000),
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (trang_thai<>'BI_TU_CHOI' OR (ly_do_tu_choi IS NOT NULL AND length(btrim(ly_do_tu_choi))>0))
);

CREATE TABLE IF NOT EXISTS giao_dich_quy (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  quy_id BIGINT NOT NULL REFERENCES quy(id) ON DELETE RESTRICT,
  yeu_cau_dong_gop_id BIGINT UNIQUE REFERENCES yeu_cau_dong_gop(id) ON DELETE RESTRICT,
  loai loai_giao_dich NOT NULL, so_tien NUMERIC(15,2) NOT NULL CHECK (so_tien>0),
  ngay DATE NOT NULL, noi_dung VARCHAR(500),
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(), cap_nhat_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (yeu_cau_dong_gop_id IS NULL OR loai='THU')
);
CREATE INDEX IF NOT EXISTS idx_giao_dich_quy_ngay ON giao_dich_quy(quy_id,ngay);

CREATE TABLE IF NOT EXISTS chung_tu (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  giao_dich_quy_id BIGINT REFERENCES giao_dich_quy(id) ON DELETE RESTRICT,
  yeu_cau_dong_gop_id BIGINT REFERENCES yeu_cau_dong_gop(id) ON DELETE RESTRICT,
  ten_tep VARCHAR(255) NOT NULL, loai_tep VARCHAR(100) NOT NULL, duong_dan_luu TEXT NOT NULL,
  tao_luc TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(giao_dich_quy_id,yeu_cau_dong_gop_id)=1)
);

CREATE OR REPLACE FUNCTION fn_cap_nhat_luc() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.cap_nhat_luc := now(); RETURN NEW; END $$;
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['dong_ho','chi','ho_so_thanh_vien','tai_khoan','xac_thuc_totp','vai_tro_phan_quyen',
    'quan_he_pha_he','cau_hinh_rieng_tu','yeu_cau_gia_nhap','loi_moi_gia_nhap',
    'yeu_cau_cap_nhat_pha_he','bai_viet','binh_luan','cam_xuc','su_kien','thong_bao',
    'quy','dot_dong_gop','yeu_cau_dong_gop','giao_dich_quy'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_cap_nhat_luc ON %I',t,t);
    EXECUTE format('CREATE TRIGGER trg_%I_cap_nhat_luc BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_cap_nhat_luc()',t,t);
  END LOOP;
END $$;

-- Trigger chong tao vong to tien; khoa dong ho de tranh hai cap nhat dong thoi tao vong.
CREATE OR REPLACE FUNCTION fn_chan_vong_pha_he() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE dong_ho_a BIGINT; dong_ho_b BIGINT; tao_vong BOOLEAN;
BEGIN
  SELECT dong_ho_id INTO dong_ho_a FROM ho_so_thanh_vien WHERE id=NEW.tu_ho_so_id;
  SELECT dong_ho_id INTO dong_ho_b FROM ho_so_thanh_vien WHERE id=NEW.den_ho_so_id;
  IF dong_ho_a IS NULL OR dong_ho_a<>dong_ho_b THEN RAISE EXCEPTION 'Hai ho so phai thuoc cung dong ho'; END IF;
  IF NOT NEW.hieu_luc OR NEW.loai_quan_he='VO_CHONG' THEN RETURN NEW; END IF;
  PERFORM 1 FROM dong_ho WHERE id=dong_ho_a FOR UPDATE;
  WITH RECURSIVE hau_due(id) AS (
    SELECT NEW.den_ho_so_id
    UNION
    SELECT q.den_ho_so_id FROM quan_he_pha_he q JOIN hau_due h ON q.tu_ho_so_id=h.id
      WHERE q.hieu_luc AND q.loai_quan_he IN ('CHA_CON','ME_CON')
  ) SELECT EXISTS(SELECT 1 FROM hau_due WHERE id=NEW.tu_ho_so_id) INTO tao_vong;
  IF tao_vong THEN RAISE EXCEPTION 'Quan he tao vong to tien'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_qh_chan_vong ON quan_he_pha_he;
CREATE TRIGGER trg_qh_chan_vong BEFORE INSERT OR UPDATE OF tu_ho_so_id,den_ho_so_id,loai_quan_he,hieu_luc
  ON quan_he_pha_he FOR EACH ROW EXECUTE FUNCTION fn_chan_vong_pha_he();

CREATE OR REPLACE FUNCTION fn_kiem_tra_chuyen_trang_thai_yc() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.trang_thai=OLD.trang_thai THEN RETURN NEW; END IF;
  IF OLD.trang_thai='CHO_DUYET' AND NEW.trang_thai IN ('CHO_BO_SUNG','DA_DUYET','BI_TU_CHOI','DA_HUY') THEN RETURN NEW; END IF;
  IF OLD.trang_thai='CHO_BO_SUNG' AND NEW.trang_thai IN ('CHO_DUYET','BI_TU_CHOI','DA_HUY') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Chuyen trang thai yeu cau khong hop le: % -> %',OLD.trang_thai,NEW.trang_thai;
END $$;
DROP TRIGGER IF EXISTS trg_ycgn_chuyen_trang_thai ON yeu_cau_gia_nhap;
CREATE TRIGGER trg_ycgn_chuyen_trang_thai BEFORE UPDATE OF trang_thai ON yeu_cau_gia_nhap
  FOR EACH ROW EXECUTE FUNCTION fn_kiem_tra_chuyen_trang_thai_yc();
DROP TRIGGER IF EXISTS trg_yccn_chuyen_trang_thai ON yeu_cau_cap_nhat_pha_he;
CREATE TRIGGER trg_yccn_chuyen_trang_thai BEFORE UPDATE OF trang_thai ON yeu_cau_cap_nhat_pha_he
  FOR EACH ROW EXECUTE FUNCTION fn_kiem_tra_chuyen_trang_thai_yc();

CREATE OR REPLACE FUNCTION fn_chan_tu_duyet() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE nguoi_tao BIGINT;
BEGIN
  IF NEW.yeu_cau_gia_nhap_id IS NOT NULL THEN
    SELECT tai_khoan_id INTO nguoi_tao FROM yeu_cau_gia_nhap WHERE id=NEW.yeu_cau_gia_nhap_id;
  ELSE
    SELECT tai_khoan_tao_id INTO nguoi_tao FROM yeu_cau_cap_nhat_pha_he WHERE id=NEW.yeu_cau_cap_nhat_id;
  END IF;
  IF nguoi_tao IS NULL THEN RAISE EXCEPTION 'Khong tim thay yeu cau can duyet'; END IF;
  IF nguoi_tao=NEW.nguoi_duyet_id THEN RAISE EXCEPTION 'Nguoi tao yeu cau khong duoc tu duyet (BR-12)'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_qdd_nguoi_duyet ON quyet_dinh_duyet;
CREATE TRIGGER trg_qdd_nguoi_duyet BEFORE INSERT ON quyet_dinh_duyet
  FOR EACH ROW EXECUTE FUNCTION fn_chan_tu_duyet();

CREATE OR REPLACE FUNCTION fn_chan_sua_ban_ghi_bat_bien() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Ban ghi chi them, khong duoc sua hoac xoa'; END $$;
DROP TRIGGER IF EXISTS trg_qdd_chi_them ON quyet_dinh_duyet;
CREATE TRIGGER trg_qdd_chi_them BEFORE UPDATE OR DELETE ON quyet_dinh_duyet
  FOR EACH ROW EXECUTE FUNCTION fn_chan_sua_ban_ghi_bat_bien();
DROP TRIGGER IF EXISTS trg_nhat_ky_chi_them ON nhat_ky_thay_doi;
CREATE TRIGGER trg_nhat_ky_chi_them BEFORE UPDATE OR DELETE ON nhat_ky_thay_doi
  FOR EACH ROW EXECUTE FUNCTION fn_chan_sua_ban_ghi_bat_bien();

CREATE OR REPLACE FUNCTION fn_xu_ly_ho_so_qua_doi() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.trang_thai='DA_MAT' AND OLD.trang_thai IS DISTINCT FROM 'DA_MAT' THEN
    UPDATE tai_khoan t SET trang_thai='BI_KHOA'
      FROM tai_khoan_ho_so th
      WHERE th.tai_khoan_id=t.id AND th.ho_so_id=NEW.id;
    UPDATE vai_tro_phan_quyen v SET hieu_luc_den=GREATEST(v.hieu_luc_tu,CURRENT_DATE)
      FROM tai_khoan_ho_so th
      WHERE th.tai_khoan_id=v.tai_khoan_id AND th.dong_ho_id=NEW.dong_ho_id
        AND th.ho_so_id=NEW.id AND v.hieu_luc_den IS NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_ho_so_qua_doi ON ho_so_thanh_vien;
CREATE TRIGGER trg_ho_so_qua_doi AFTER UPDATE OF trang_thai ON ho_so_thanh_vien
  FOR EACH ROW EXECUTE FUNCTION fn_xu_ly_ho_so_qua_doi();

-- So du quy la ket qua tinh tu giao dich, khong luu gia tri du de tranh lech.
CREATE OR REPLACE VIEW v_so_du_quy AS
SELECT q.id AS quy_id,q.ten,
  q.so_du_dau_ky + COALESCE(SUM(CASE WHEN g.loai='THU' THEN g.so_tien ELSE -g.so_tien END),0) AS so_du
FROM quy q LEFT JOIN giao_dich_quy g ON g.quy_id=q.id GROUP BY q.id,q.ten,q.so_du_dau_ky;

-- So lieu tuong tac de he thong hien thi; viec danh gia muc do gan ket do con nguoi thuc hien.
CREATE OR REPLACE VIEW v_tuong_tac_bai_viet AS
SELECT b.id AS bai_viet_id,b.dong_ho_id,b.chi_id,b.tao_luc,
  COUNT(DISTINCT c.id) FILTER (WHERE c.trang_thai='HIEN_THI') AS so_binh_luan,
  COUNT(DISTINCT x.id) AS so_cam_xuc
FROM bai_viet b LEFT JOIN binh_luan c ON c.bai_viet_id=b.id
LEFT JOIN cam_xuc x ON x.bai_viet_id=b.id
WHERE b.trang_thai='DA_XUAT_BAN'
GROUP BY b.id,b.dong_ho_id,b.chi_id,b.tao_luc;

-- ================================================================================
-- BỘ DỮ LIỆU MẪU (SEED DATA) CHO CƠ SỞ DỮ LIỆU GIA PHẢ
-- ================================================================================

-- 1. DÒNG HỌ
INSERT INTO dong_ho (id, ma_gia_pha, ten, trang_thai)
OVERRIDING SYSTEM VALUE
VALUES (1, 'GP-NGUYEN-2026', 'Dòng họ Nguyễn Phúc', 'DANG_HOAT_DONG')
ON CONFLICT (id) DO UPDATE SET ten = EXCLUDED.ten;

-- 2. CHI TỘC
INSERT INTO chi (id, dong_ho_id, ten_chi)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, 'Chi Trưởng (Nhất Chi)'),
  (2, 1, 'Chi Thứ (Nhị Chi)')
ON CONFLICT (id) DO UPDATE SET ten_chi = EXCLUDED.ten_chi;

-- 3. HỒ SƠ THÀNH VIÊN (3 THẾ HỆ)
-- Đời 1: Cụ Thủy tổ (Khởi) & Cụ Bà (Lành) - Đều đã mất
-- Đời 2: Ông An (Trưởng họ - Chi Trưởng), Bà Hoa (Vợ), Ông Bình (Trưởng chi - Chi Thứ)
-- Đời 3: Anh Cường, Chị Dung (Con của Ông An & Bà Hoa)
INSERT INTO ho_so_thanh_vien (id, dong_ho_id, chi_id, ma_thanh_vien, ho_ten, gioi_tinh, ngay_sinh, ngay_mat, loai_lich_ngay_mat, so_dien_thoai, noi_an_tang, the_he, trang_thai, version)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, NULL, 'TV-001', 'Nguyễn Phúc Khởi', 'NAM', '1920-01-01', '2000-08-15', 'AM', NULL, 'Khu lăng mộ tổ họ Nguyễn Phúc, Phú Vang, Thừa Thiên Huế', 1, 'DA_MAT', 1),
  (2, 1, NULL, 'TV-002', 'Trần Thị Lành', 'NU', '1925-05-10', '2005-03-20', 'AM', NULL, 'Khu nghĩa trang gia tộc, Phú Vang, Thừa Thiên Huế', 1, 'DA_MAT', 1),
  (3, 1, 1, 'TV-003', 'Nguyễn Phúc An', 'NAM', '1950-02-15', NULL, NULL, '+84901234567', NULL, 2, 'DANG_SONG', 1),
  (4, 1, 1, 'TV-004', 'Lê Thị Hoa', 'NU', '1953-06-20', NULL, NULL, '+84902345678', NULL, 2, 'DANG_SONG', 1),
  (5, 1, 2, 'TV-005', 'Nguyễn Phúc Bình', 'NAM', '1955-09-12', NULL, NULL, '+84912345678', NULL, 2, 'DANG_SONG', 1),
  (6, 1, 1, 'TV-006', 'Nguyễn Phúc Cường', 'NAM', '1980-11-20', NULL, NULL, '+84923456789', NULL, 3, 'DANG_SONG', 1),
  (7, 1, 1, 'TV-007', 'Nguyễn Phúc Dung', 'NU', '1985-04-18', NULL, NULL, '+84934567890', NULL, 3, 'DANG_SONG', 1)
ON CONFLICT (id) DO UPDATE SET ho_ten = EXCLUDED.ho_ten;

-- Cập nhật Nút gốc của Dòng họ là Cụ Thủy tổ
UPDATE dong_ho SET ho_so_goc_id = 1 WHERE id = 1;

-- Cập nhật Trưởng chi cho Chi Trưởng và Chi Thứ
UPDATE chi SET ho_so_truong_chi_id = 3 WHERE id = 1;
UPDATE chi SET ho_so_truong_chi_id = 5 WHERE id = 2;

-- 4. TÀI KHOẢN NGƯỜI DÙNG
INSERT INTO tai_khoan (id, ma_tai_khoan, so_dien_thoai, email, mat_khau_hash, loai_xac_thuc, google_sub, trang_thai)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 'TK-001', '+84901234567', 'truongho@giapha.vn', '$argon2id$v=19$m=65536,t=3,p=4$qN8kE6/1Q5qX0W1v0G2J5Q$R5N5M2mYjPqL7P8b1N3rYQ', 'NOI_BO', NULL, 'HOAT_DONG'),
  (2, 'TK-002', '+84912345678', 'truongchi@giapha.vn', '$argon2id$v=19$m=65536,t=3,p=4$qN8kE6/1Q5qX0W1v0G2J5Q$R5N5M2mYjPqL7P8b1N3rYQ', 'NOI_BO', NULL, 'HOAT_DONG'),
  (3, 'TK-003', '+84923456789', 'thanhvien@giapha.vn', '$argon2id$v=19$m=65536,t=3,p=4$qN8kE6/1Q5qX0W1v0G2J5Q$R5N5M2mYjPqL7P8b1N3rYQ', 'NOI_BO', NULL, 'HOAT_DONG'),
  (4, 'TK-004', '+84934567890', 'nguyenphucdung.dev@gmail.com', NULL, 'GOOGLE', 'google-oauth2|109283746582910283746', 'HOAT_DONG')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

-- 5. XÁC THỰC TOTP (BẢO MẬT 2FA CHO TRƯỞNG HỌ)
INSERT INTO xac_thuc_totp (id, tai_khoan_id, khoa_bi_mat_ma_hoa, da_kich_hoat)
OVERRIDING SYSTEM VALUE
VALUES (1, 1, 'enc_aes256_mock_secret_key_truong_ho_2fa', true)
ON CONFLICT (id) DO NOTHING;

-- 6. LIÊN KẾT TÀI KHOẢN VỚI HỒ SƠ
INSERT INTO tai_khoan_ho_so (id, tai_khoan_id, dong_ho_id, ho_so_id)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, 1, 3), -- TK 1 (truongho) -> Hồ sơ Ông An
  (2, 2, 1, 5), -- TK 2 (truongchi) -> Hồ sơ Ông Bình
  (3, 3, 1, 6), -- TK 3 (thanhvien) -> Hồ sơ Anh Cường
  (4, 4, 1, 7)  -- TK 4 (google user) -> Hồ sơ Chị Dung
ON CONFLICT (id) DO NOTHING;

-- 7. VAI TRÒ & PHÂN QUYỀN
INSERT INTO vai_tro_phan_quyen (id, tai_khoan_id, loai_vai_tro, pham_vi, dong_ho_id, chi_id, hieu_luc_tu)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, 'TRUONG_HO', 'TOAN_HO', 1, NULL, CURRENT_DATE),
  (2, 2, 'TRUONG_CHI', 'CHI', NULL, 2, CURRENT_DATE),
  (3, 3, 'THANH_VIEN', 'CHI', NULL, 1, CURRENT_DATE),
  (4, 4, 'THANH_VIEN', 'CHI', NULL, 1, CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

-- 8. QUAN HỆ PHẢ HỆ (CÂY GIA PHẢ ĐẦY ĐỦ 3 ĐỜI)
INSERT INTO quan_he_pha_he (id, tu_ho_so_id, den_ho_so_id, loai_quan_he, hieu_luc)
OVERRIDING SYSTEM VALUE
VALUES 
  -- Đời 1: Vợ chồng Cụ Khởi - Cụ Lành
  (1, 1, 2, 'VO_CHONG', true),
  -- Đời 1 -> Đời 2: Cụ Khởi sinh Ông An & Ông Bình
  (2, 1, 3, 'CHA_CON', true),
  (3, 2, 3, 'ME_CON', true),
  (4, 1, 5, 'CHA_CON', true),
  (5, 2, 5, 'ME_CON', true),
  -- Đời 2: Vợ chồng Ông An - Bà Hoa
  (6, 3, 4, 'VO_CHONG', true),
  -- Đời 2 -> Đời 3: Ông An & Bà Hoa sinh Anh Cường & Chị Dung
  (7, 3, 6, 'CHA_CON', true),
  (8, 4, 6, 'ME_CON', true),
  (9, 3, 7, 'CHA_CON', true),
  (10, 4, 7, 'ME_CON', true)
ON CONFLICT (id) DO NOTHING;

-- 9. CẤU HÌNH QUYỀN RIÊNG TƯ
INSERT INTO cau_hinh_rieng_tu (id, ho_so_id, truong, pham_vi)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 3, 'SO_DIEN_THOAI', 'TOAN_HO'),
  (2, 6, 'SO_DIEN_THOAI', 'TRONG_CHI'),
  (3, 7, 'EMAIL', 'CHI_TOI')
ON CONFLICT (id) DO NOTHING;

-- 10. BẢNG TIN DÒNG HỌ & TƯƠNG TÁC
INSERT INTO bai_viet (id, tai_khoan_id, dong_ho_id, chi_id, noi_dung, pham_vi, chuyen_muc, trang_thai, ghim)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, 1, NULL, 'Kính báo toàn thể con cháu dòng họ: Công trình trùng tu mái ngói và cổng Từ Đường Dòng Họ đã hoàn tất tốt đẹp trước ngày giỗ tổ.', 'TOAN_HO', 'GOC_HOAI_NIEM', 'DA_XUAT_BAN', true),
  (2, 3, 1, 1, 'Chia sẻ cùng bà con trong Chi Trưởng: Cháu Nguyễn Phúc Dung đã bảo vệ xuất sắc luận án Thạc sĩ tại Đại học Quốc gia!', 'TOAN_HO', 'KHUYEN_HOC_THANH_TICH', 'DA_XUAT_BAN', false)
ON CONFLICT (id) DO NOTHING;

-- Tệp đính kèm bài viết
INSERT INTO tep_dinh_kem (id, bai_viet_id, yeu_cau_cap_nhat_id, yeu_cau_gia_nhap_id, tai_khoan_tai_len_id, ten_tep, loai_tep, dung_luong, duong_dan_luu)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, NULL, NULL, 1, 'nha_tho_to_hoan_thanh.jpg', 'image/jpeg', 2048576, 'https://storage.giapha.vn/media/2026/tu_duong_1.jpg')
ON CONFLICT (id) DO NOTHING;

-- Bình luận bài viết
INSERT INTO binh_luan (id, bai_viet_id, tai_khoan_id, noi_dung, trang_thai)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, 2, 'Hoan hỉ và cảm ơn Bác Trưởng họ cùng ban kiến thiết đã dốc sức vì việc họ.', 'HIEN_THI'),
  (2, 2, 1, 'Bác chúc mừng cháu Dung đã làm rạng danh dòng họ!', 'HIEN_THI')
ON CONFLICT (id) DO NOTHING;

-- Cảm xúc bài viết
INSERT INTO cam_xuc (id, bai_viet_id, tai_khoan_id, loai)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, 2, 'THICH'),
  (2, 1, 3, 'TIM'),
  (3, 2, 1, 'TIM'),
  (4, 2, 2, 'THICH')
ON CONFLICT (id) DO NOTHING;

-- 11. SỰ KIỆN DÒNG HỌ & LỊCH GIỖ
INSERT INTO su_kien (id, dong_ho_id, chi_id, ho_so_id, ten, ngay_goc, loai_lich, ngay_duong, dia_diem, pham_vi, loai_su_kien)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, NULL, 1, 'Lễ Giỗ Cụ Thủy Tổ Nguyễn Phúc Khởi', '2000-08-15', 'AM', '2026-09-25', 'Từ Đường Dòng Họ, Thừa Thiên Huế', 'TOAN_HO', 'LICH_GIO'),
  (2, 1, NULL, NULL, 'Hội Nghị Khuyến Học & Tất Niên 2026', '2026-12-28', 'DUONG', '2026-12-28', 'Nhà Văn Hóa Dòng Họ', 'TOAN_HO', 'SU_KIEN_THUONG')
ON CONFLICT (id) DO NOTHING;

-- 12. THÔNG BÁO HỆ THỐNG
INSERT INTO thong_bao (id, tai_khoan_id, su_kien_id, loai, noi_dung, da_doc, trang_thai_gui)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 2, 1, 'NHAC_SU_KIEN', 'Sắp tới ngày 15/08 Âm lịch là Lễ Giỗ Cụ Thủy Tổ, kính mời quý chi sắp xếp về dự lễ.', false, 'DA_GUI'),
  (2, 3, 1, 'NHAC_SU_KIEN', 'Sắp tới ngày 15/08 Âm lịch là Lễ Giỗ Cụ Thủy Tổ, kính mời quý chi sắp xếp về dự lễ.', true, 'DA_GUI')
ON CONFLICT (id) DO NOTHING;

-- 13. BẦU CHỌN TRƯỞNG HỌ
INSERT INTO phien_chon_truong_ho (id, dong_ho_id, trang_thai, bat_dau_luc, ket_thuc_luc, ung_vien_duoc_chon_id, nguoi_xac_nhan_id, ghi_chu_ket_qua)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, 'DA_KET_THUC', '2026-01-01 08:00:00+07', '2026-01-15 17:00:00+07', 3, 1, 'Tín nhiệm Bác Nguyễn Phúc An tiếp tục giữ vai trò Trưởng họ')
ON CONFLICT (id) DO NOTHING;

INSERT INTO phieu_bau_truong_ho (id, phien_id, dong_ho_id, chi_id, truong_chi_tai_khoan_id, ung_vien_ho_so_id, lua_chon, ly_do)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, 1, 2, 2, 3, 'DONG_Y', 'Bác An uy tín và gương mẫu')
ON CONFLICT (id) DO NOTHING;

-- 14. QUẢN LÝ QUỸ & GIAO DỊCH THU CHI (Kiểm tra View v_so_du_quy)
INSERT INTO quy (id, dong_ho_id, chi_id, ten, cap_quy, so_du_dau_ky)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, NULL, 'Quỹ Khuyến Học Dòng Họ Nguyễn Phúc', 'TOAN_HO', 10000000),
  (2, 1, NULL, 'Quỹ Trùng Tu Từ Đường Dòng Họ', 'TOAN_HO', 50000000)
ON CONFLICT (id) DO UPDATE SET ten = EXCLUDED.ten;

-- Đợt vận động đóng góp
INSERT INTO dot_dong_gop (id, quy_id, ten, muc_dich, bat_dau, ket_thuc)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, 'Đợt Vận Động Khuyến Học Năm Học 2026 - 2027', 'Học bổng cho các cháu đỗ đại học và vượt khó học giỏi', '2026-09-01', '2026-11-30')
ON CONFLICT (id) DO NOTHING;

-- Yêu cầu đóng góp từ thành viên
INSERT INTO yeu_cau_dong_gop (id, dot_dong_gop_id, tai_khoan_id, so_tien, thoi_diem_chuyen, trang_thai)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, 3, 5000000, '2026-10-01 10:30:00+07', 'DA_XAC_NHAN')
ON CONFLICT (id) DO NOTHING;

-- Giao dịch thu và chi thực tế
INSERT INTO giao_dich_quy (id, quy_id, yeu_cau_dong_gop_id, loai, so_tien, ngay, noi_dung)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, 1, 'THU', 5000000, '2026-10-01', 'Thu tiền ủng hộ quỹ khuyến học từ anh Cường'),
  (2, 1, NULL, 'CHI', 3000000, '2026-10-15', 'Chi khen thưởng học bổng cho các cháu học sinh giỏi')
ON CONFLICT (id) DO NOTHING;

-- Chứng từ đính kèm
INSERT INTO chung_tu (id, giao_dich_quy_id, yeu_cau_dong_gop_id, ten_tep, loai_tep, duong_dan_luu)
OVERRIDING SYSTEM VALUE
VALUES 
  (1, 1, NULL, 'bien_lai_thu_001.pdf', 'application/pdf', 'https://storage.giapha.vn/chung_tu/2026/bl_001.pdf'),
  (2, NULL, 1, 'sao_ke_ck_anh_cuong.png', 'image/png', 'https://storage.giapha.vn/chung_tu/2026/sk_cuong.png')
ON CONFLICT (id) DO NOTHING;

-- Đồng bộ giá trị SEQUENCE cho các bảng identity
SELECT setval(pg_get_serial_sequence('dong_ho', 'id'), COALESCE(MAX(id), 1)) FROM dong_ho;
SELECT setval(pg_get_serial_sequence('chi', 'id'), COALESCE(MAX(id), 1)) FROM chi;
SELECT setval(pg_get_serial_sequence('ho_so_thanh_vien', 'id'), COALESCE(MAX(id), 1)) FROM ho_so_thanh_vien;
SELECT setval(pg_get_serial_sequence('tai_khoan', 'id'), COALESCE(MAX(id), 1)) FROM tai_khoan;
SELECT setval(pg_get_serial_sequence('xac_thuc_totp', 'id'), COALESCE(MAX(id), 1)) FROM xac_thuc_totp;
SELECT setval(pg_get_serial_sequence('tai_khoan_ho_so', 'id'), COALESCE(MAX(id), 1)) FROM tai_khoan_ho_so;
SELECT setval(pg_get_serial_sequence('vai_tro_phan_quyen', 'id'), COALESCE(MAX(id), 1)) FROM vai_tro_phan_quyen;
SELECT setval(pg_get_serial_sequence('quan_he_pha_he', 'id'), COALESCE(MAX(id), 1)) FROM quan_he_pha_he;
SELECT setval(pg_get_serial_sequence('cau_hinh_rieng_tu', 'id'), COALESCE(MAX(id), 1)) FROM cau_hinh_rieng_tu;
SELECT setval(pg_get_serial_sequence('bai_viet', 'id'), COALESCE(MAX(id), 1)) FROM bai_viet;
SELECT setval(pg_get_serial_sequence('tep_dinh_kem', 'id'), COALESCE(MAX(id), 1)) FROM tep_dinh_kem;
SELECT setval(pg_get_serial_sequence('binh_luan', 'id'), COALESCE(MAX(id), 1)) FROM binh_luan;
SELECT setval(pg_get_serial_sequence('cam_xuc', 'id'), COALESCE(MAX(id), 1)) FROM cam_xuc;
SELECT setval(pg_get_serial_sequence('su_kien', 'id'), COALESCE(MAX(id), 1)) FROM su_kien;
SELECT setval(pg_get_serial_sequence('thong_bao', 'id'), COALESCE(MAX(id), 1)) FROM thong_bao;
SELECT setval(pg_get_serial_sequence('phien_chon_truong_ho', 'id'), COALESCE(MAX(id), 1)) FROM phien_chon_truong_ho;
SELECT setval(pg_get_serial_sequence('phieu_bau_truong_ho', 'id'), COALESCE(MAX(id), 1)) FROM phieu_bau_truong_ho;
SELECT setval(pg_get_serial_sequence('quy', 'id'), COALESCE(MAX(id), 1)) FROM quy;
SELECT setval(pg_get_serial_sequence('dot_dong_gop', 'id'), COALESCE(MAX(id), 1)) FROM dot_dong_gop;
SELECT setval(pg_get_serial_sequence('yeu_cau_dong_gop', 'id'), COALESCE(MAX(id), 1)) FROM yeu_cau_dong_gop;
SELECT setval(pg_get_serial_sequence('giao_dich_quy', 'id'), COALESCE(MAX(id), 1)) FROM giao_dich_quy;
SELECT setval(pg_get_serial_sequence('chung_tu', 'id'), COALESCE(MAX(id), 1)) FROM chung_tu;

COMMIT;

-- ================================================================================
-- CÁC CÂU LỆNH TRUY VẤN MẪU ĐỂ CÁC THÀNH VIÊN KIỂM TRA NGAY:
-- ================================================================================

/*
-- 1. Xem danh sách thành viên trong dòng họ:
SET search_path TO gia_pha, public;
SELECT h.id, h.ma_thanh_vien, h.ho_ten, h.gioi_tinh, h.the_he, h.trang_thai, c.ten_chi
FROM ho_so_thanh_vien h
LEFT JOIN chi c ON h.chi_id = c.id
ORDER BY h.the_he, h.id;

-- 2. Truy vấn đệ quy cây gia phả (Recursive CTE) từ Cụ Thủy tổ đến đời con cháu:
SET search_path TO gia_pha, public;
WITH RECURSIVE cay_pha_he AS (
    SELECT h.id, h.ho_ten, h.the_he, h.trang_thai, ARRAY[h.ho_ten::text] AS duong_dan
    FROM ho_so_thanh_vien h
    WHERE h.the_he = 1 AND h.gioi_tinh = 'NAM'
    UNION ALL
    SELECT con.id, con.ho_ten, con.the_he, con.trang_thai, c.duong_dan || con.ho_ten::text
    FROM ho_so_thanh_vien con
    JOIN quan_he_pha_he q ON q.den_ho_so_id = con.id AND q.loai_quan_he = 'CHA_CON' AND q.hieu_luc = true
    JOIN cay_pha_he c ON q.tu_ho_so_id = c.id
)
SELECT the_he, repeat('    ', the_he - 1) || ho_ten AS phan_cap, trang_thai, array_to_string(duong_dan, ' -> ') AS duong_dan_pha_he
FROM cay_pha_he ORDER BY the_he, id;

-- 3. Kiểm tra số dư các quỹ qua VIEW tự động:
SET search_path TO gia_pha, public;
SELECT * FROM v_so_du_quy;

-- 4. Kiểm tra tương tác bài viết bảng tin qua VIEW:
SET search_path TO gia_pha, public;
SELECT * FROM v_tuong_tac_bai_viet;

-- 5. Xem lịch giỗ và sự kiện dòng họ:
SET search_path TO gia_pha, public;
SELECT s.id, s.ten, s.loai_su_kien, s.ngay_duong, s.dia_diem, h.ho_ten AS ho_so_gio
FROM su_kien s
LEFT JOIN ho_so_thanh_vien h ON s.ho_so_id = h.id;
*/
