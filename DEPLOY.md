# Deploy SmartBus (gợi ý)

## Mục tiêu
- Chạy Flask qua WSGI (`gunicorn`)
- Dùng `DATABASE_URL` + `SECRET_KEY` từ env
- Tránh mất dữ liệu khi deploy (khuyến nghị Postgres)

## 0) Backup dữ liệu local (khuyên làm trước)
File dữ liệu local của bạn là `smartbus.db` (đang được `.gitignore`, nên **không** bị đẩy lên repo).

Backup nhanh (Windows):
```powershell
Copy-Item smartbus.db smartbus_backup_$(Get-Date -Format yyyyMMdd_HHmmss).db
```

Lưu ý: deploy lên web **không** tự xoá dữ liệu local trên máy bạn. Rủi ro “toang” thường xảy ra ở **production** nếu bạn dùng SQLite trên filesystem không persistent.

## 1) Chuẩn bị biến môi trường
Tối thiểu:
- `SECRET_KEY`: chuỗi ngẫu nhiên dài
- `DATABASE_URL`: khuyến nghị Postgres (Render/Railway thường cấp sẵn)

Khuyến nghị thêm (để an toàn):
- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD` (đặt mạnh, không dùng `admin123` khi deploy)

Tuỳ chọn:
- `OSRM_BASE_URL` (mặc định: `https://router.project-osrm.org`)
- `OSRM_PROFILE` (mặc định: `driving`)
- `OSRM_TIMEOUT` (mặc định: `8`)

## 2) Start command (production)
Repo đã có:
- `wsgi.py` (entrypoint)
- `Procfile`
- `Dockerfile`

Start command phổ biến:
```bash
gunicorn wsgi:app --bind 0.0.0.0:$PORT
```

## 3) Database: tránh “toang” khi deploy
### Khuyến nghị: Postgres
- Dễ backup/restore, phù hợp production.
- Chỉ cần set `DATABASE_URL` (app đã tự đọc).

### Nếu vẫn muốn SQLite
- Chỉ ổn khi nền tảng có **persistent disk/volume** gắn vào container.
- Nếu platform dùng filesystem ephemeral (deploy xong reset), `smartbus.db` sẽ bị mất.

## 4) Import dữ liệu lên production (tuỳ chọn)
Tuỳ mục tiêu demo:
- Demo nhanh: seed lại bằng CSV (`scripts/seed_stops_from_csv.py`).
- Muốn mang đúng dữ liệu local lên production: nên migrate sang Postgres (ưu tiên), tránh copy file `.db` lên host.

Bạn có thể bắt đầu bằng cách seed lại các tuyến/trạm (đủ để demo UI) rồi tính tiếp migration “xịn” sau.

## 5) Gợi ý nền tảng
### Render (dễ)
- Tạo Web Service từ repo
- Build: `pip install -r requirements.txt`
- Start: `gunicorn wsgi:app --bind 0.0.0.0:$PORT`
- Add Postgres + set `DATABASE_URL`, `SECRET_KEY`

### Railway (nhanh)
- Add Postgres plugin
- Set start command tương tự

### Docker (linh hoạt)
```bash
docker build -t smartbus .
docker run -p 8000:8000 -e SECRET_KEY=... -e DATABASE_URL=... smartbus
```
