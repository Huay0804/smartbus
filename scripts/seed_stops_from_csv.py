#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Seed stops into SmartBus database from CSV.

CSV columns (header required):
route_code,direction,stop_order,stop_name,address,lat,lng

- direction must be DI or VE
- route_code is your display code (e.g., "01") stored in TuyenXe.maHienThi (adjust if yours differs)

Usage (recommended):
  python seed_stops_from_csv.py --csv stops_tuyen_01.csv --route-code 01 --mode upsert

Modes:
- upsert (default): insert new, update existing by (tuyen_id, huong, thuTuTrenTuyen)
- replace: delete existing stops for that route + direction before inserting
"""

import argparse
import csv
import sys


import os
import sys

# Ensure project root is on PYTHONPATH when running from scripts/
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(THIS_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

def fail(msg: str, code: int = 2):
    print(f"[ERROR] {msg}", file=sys.stderr)
    sys.exit(code)

def load_app():
    """
    Try to import your Flask app + db + models.
    You may need to edit these imports to match your project.
    """
    # Try common patterns
    try:
        from app import app, db, TuyenXe, TramDung  # type: ignore
        return app, db, TuyenXe, TramDung
    except Exception:
        pass

    try:
        from app import app, db  # type: ignore
        from models import TuyenXe, TramDung  # type: ignore
        return app, db, TuyenXe, TramDung
    except Exception:
        pass

    # If you use factory pattern, edit here:
    # from yourpackage import create_app, db
    # from yourpackage.models import TuyenXe, TramDung
    # app = create_app()
    # return app, db, TuyenXe, TramDung

    fail("Không import được app/db/models. Hãy mở file này và chỉnh hàm load_app() theo cấu trúc project của bạn.")

def read_csv(path: str):
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        required = {"route_code","direction","stop_order","stop_name","address","lat","lng"}
        if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
            fail(f"CSV thiếu cột. Cần: {sorted(required)}. Đang có: {reader.fieldnames}")
        rows = []
        for i, row in enumerate(reader, start=2):
            rc = (row.get("route_code") or "").strip()
            direction = (row.get("direction") or "").strip().upper()
            if direction not in ("DI","VE"):
                fail(f"Dòng {i}: direction phải DI/VE. Nhận '{direction}'.")
            try:
                order = int((row.get("stop_order") or "").strip())
            except Exception:
                fail(f"Dòng {i}: stop_order không hợp lệ: {row.get('stop_order')}")
            name = (row.get("stop_name") or "").strip()
            addr = (row.get("address") or "").strip()
            if not name:
                fail(f"Dòng {i}: stop_name rỗng.")
            try:
                lat = float((row.get("lat") or "").strip())
                lng = float((row.get("lng") or "").strip())
            except Exception:
                fail(f"Dòng {i}: lat/lng không hợp lệ: {row.get('lat')}, {row.get('lng')}")
            rows.append((rc, direction, order, name, addr, lat, lng))
        return rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="Path to CSV")
    ap.add_argument("--route-code", required=True, help="Route display code, e.g., 01")
    ap.add_argument("--mode", choices=["upsert","replace"], default="upsert")
    args = ap.parse_args()

    app, db, TuyenXe, TramDung = load_app()
    rows = read_csv(args.csv)

    with app.app_context():
        # Find route by maHienThi (adjust if your schema differs)
        tuyen = TuyenXe.query.filter_by(maHienThi=args.route_code).first()
        if not tuyen:
            fail(f"Không tìm thấy tuyến có maHienThi='{args.route_code}'. Hãy tạo tuyến trước hoặc chỉnh truy vấn trong script.")
        tuyen_id = getattr(tuyen, "maTuyen", None) or getattr(tuyen, "id", None)
        if not tuyen_id:
            fail("Không lấy được tuyen_id (maTuyen/id). Hãy chỉnh script để map đúng PK của TuyenXe.")

        # Optional replace per direction
        if args.mode == "replace":
            for direction in ("DI","VE"):
                TramDung.query.filter_by(tuyen_id=tuyen_id, huong=direction).delete()
            db.session.commit()

        upserted = 0
        inserted = 0

        for rc, direction, order, name, addr, lat, lng in rows:
            # Match existing by (tuyen_id, huong, thuTuTrenTuyen)
            existing = TramDung.query.filter_by(
                tuyen_id=tuyen_id,
                huong=direction,
                thuTuTrenTuyen=order
            ).first()

            if existing:
                existing.tenTram = name
                existing.diaChi = addr
                existing.lat = lat
                existing.lng = lng
                upserted += 1
            else:
                stop = TramDung(
                    tenTram=name,
                    diaChi=addr,
                    thuTuTrenTuyen=order,
                    lat=lat,
                    lng=lng,
                    huong=direction,
                    tuyen_id=tuyen_id
                )
                db.session.add(stop)
                inserted += 1

        db.session.commit()
        print(f"[OK] route={args.route_code} inserted={inserted} updated={upserted} mode={args.mode}")

if __name__ == "__main__":
    main()
