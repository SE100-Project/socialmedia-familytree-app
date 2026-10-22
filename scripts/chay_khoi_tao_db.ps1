$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " KHOI TAO CO SO DU LIEU VA BO DU LIEU MAU (29 BANG - BAO CAO CSDL V1.2)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

$scriptPath = Join-Path $PSScriptRoot "khoi_tao_database.sql"
if (-not (Test-Path $scriptPath)) {
    Write-Error "Khong tim thay file kich ban SQL tai: $scriptPath"
    exit 1
}

# 1. Kiem tra container Docker
Write-Host "`n[1/3] Dang kiem tra container Docker Database..." -ForegroundColor Yellow
$dockerRunning = $false
try {
    $psOut = docker compose ps --services --filter "status=running" 2>$null
    if ($psOut -match "db") {
        $dockerRunning = $true
    }
} catch {
    $dockerRunning = $false
}

if ($dockerRunning) {
    Write-Host "-> Phat hien container 'db' dang chay trong Docker Compose." -ForegroundColor Green
    Write-Host "[2/3] Dang thuc thi kich ban SQL vao Docker..." -ForegroundColor Yellow
    Get-Content $scriptPath -Raw | docker compose exec -T db psql -U root -d giapha
    if ($LASTEXITCODE -eq 0) {
        Write-Host "-> Khoi tao thanh cong trong Docker!" -ForegroundColor Green
    } else {
        Write-Error "Thuc thi that bai trong Docker."
        exit $LASTEXITCODE
    }
} else {
    Write-Host "-> Container Docker chua bat. Dang thu ket noi PostgreSQL qua psql cuc bo..." -ForegroundColor Yellow
    if (Get-Command psql -ErrorAction SilentlyContinue) {
        $port = if ($env:DB_PORT) { $env:DB_PORT } else { "5433" }
        $user = if ($env:DB_USER) { $env:DB_USER } else { "root" }
        $db   = if ($env:DB_NAME) { $env:DB_NAME } else { "giapha" }
        $env:PGPASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "rootpassword" }
        
        Write-Host "Dang chay psql -h localhost -p $port -U $user -d $db..." -ForegroundColor Yellow
        psql -h localhost -p $port -U $user -d $db -f $scriptPath
    } else {
        Write-Host "GOI Y: Hay bat Docker Compose truoc bang lenh: pnpm docker:up" -ForegroundColor Red
        Write-Host "Sau do chay lai script nay." -ForegroundColor Red
        exit 1
    }
}

# 3. Kiem tra ket qua
Write-Host "`n[3/3] Kiem tra du lieu vua khoi tao (Schema 'gia_pha'):" -ForegroundColor Yellow
$verifySql = "SET search_path TO gia_pha, public; SELECT 'So dong ho: ' || count(*) FROM dong_ho UNION ALL SELECT 'So thanh vien: ' || count(*) FROM ho_so_thanh_vien UNION ALL SELECT 'So tai khoan: ' || count(*) FROM tai_khoan UNION ALL SELECT 'So quy: ' || count(*) FROM quy;"
if ($dockerRunning) {
    docker compose exec -T db psql -U root -d giapha -c $verifySql
}

Write-Host "`n======================================================================" -ForegroundColor Green
Write-Host " HOAN TAT KHOI TAO CSDL THANH CONG!" -ForegroundColor Green
Write-Host " - 29 bang nghiep vu va bao mat da san sang trong schema 'gia_pha'." -ForegroundColor Green
Write-Host " - Du lieu mau 3 the he gia pha va tai khoan demo da duoc nap." -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
