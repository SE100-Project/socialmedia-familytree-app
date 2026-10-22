#!/usr/bin/env bash
# ==============================================================================
# Script khởi tạo CSDL và nạp dữ liệu mẫu (29 bảng) cho dự án Cây gia phả.
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/khoi_tao_database.sql"

echo "======================================================================"
echo " KHỞI TẠO CƠ SỞ DỮ LIỆU & BỘ DỮ LIỆU MẪU (29 BẢNG - BÁO CÁO CSDL V1.2)"
echo "======================================================================"

if [ ! -f "$SQL_FILE" ]; then
    echo "LỖI: Không tìm thấy file $SQL_FILE"
    exit 1
fi

echo -e "\n[1/3] Đang kiểm tra container Docker Database..."
if docker compose ps --services --filter "status=running" 2>/dev/null | grep -q "db"; then
    echo "-> Phát hiện container 'db' đang chạy trong Docker Compose."
    echo "[2/3] Đang thực thi kịch bản SQL vào Docker..."
    docker compose exec -T db psql -U root -d giapha < "$SQL_FILE"
    echo "-> Khởi tạo thành công trong Docker!"
else
    echo "-> Container Docker chưa bật. Đang thử kết nối PostgreSQL qua psql cục bộ..."
    PORT="${DB_PORT:-5433}"
    USER="${DB_USER:-root}"
    DB="${DB_NAME:-giapha}"
    export PGPASSWORD="${DB_PASSWORD:-rootpassword}"

    psql -h localhost -p "$PORT" -U "$USER" -d "$DB" -f "$SQL_FILE"
fi

echo -e "\n[3/3] Kiểm tra dữ liệu vừa khởi tạo (Schema 'gia_pha'):"
VERIFY_SQL="SET search_path TO gia_pha, public; SELECT 'Số dòng họ: ' || count(*) FROM dong_ho UNION ALL SELECT 'Số thành viên: ' || count(*) FROM ho_so_thanh_vien UNION ALL SELECT 'Số tài khoản: ' || count(*) FROM tai_khoan UNION ALL SELECT 'Số quỹ: ' || count(*) FROM quy;"
docker compose exec -T db psql -U root -d giapha -c "$VERIFY_SQL"

echo -e "\n======================================================================"
echo " HOÀN TẤT KHỞI TẠO CSDL THÀNH CÔNG!"
echo "======================================================================"
