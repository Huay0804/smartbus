from flask import Flask, render_template, request, redirect, url_for, flash, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import os
import json

app = Flask(__name__)

# CẤU HÌNH FLASK & DATABASE
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(BASE_DIR, "smartbus.db")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = "change-this-secret"

db = SQLAlchemy(app)

# ==================== CÁC MODEL DỮ LIỆU ====================

class TaiKhoan(db.Model):
    __tablename__ = "tai_khoan"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    mat_khau_hash = db.Column(db.String(128), nullable=False)
    vai_tro = db.Column(db.String(20), default="KHACH")
    trangThai = db.Column(db.String(20), default="HOAT_DONG")


class KhachHang(db.Model):
    __tablename__ = "khach_hang"
    maKH = db.Column(db.Integer, primary_key=True)

    # Thuộc tính của NguoiDung
    hoTen = db.Column(db.String(100))
    soDienThoai = db.Column(db.String(20))
    diaChi = db.Column(db.String(200))
    ngaySinh = db.Column(db.String(20))  # hoặc db.Date

    # Thuộc tính riêng của KhachHang trong class diagram
    ngayDangKy = db.Column(db.String(20))  # có thể set mặc định = ngày tạo tài khoản
    soCCCD = db.Column(db.String(20))

    tai_khoan_id = db.Column(db.Integer, db.ForeignKey("tai_khoan.id"), nullable=False)
    tai_khoan = db.relationship(
        "TaiKhoan",
        backref=db.backref("khach_hang", uselist=False)
    )

    hoa_don = db.relationship("HoaDon", backref="khach_hang", lazy=True)
    # quan hệ 0..* TheTu như class diagram
    the_tus = db.relationship("TheTu", backref="khach_hang", lazy=True)


class TuyenXe(db.Model):
    __tablename__ = "tuyen_xe"
    maTuyen = db.Column(db.Integer, primary_key=True)
    maHienThi = db.Column(db.String(20), unique=True, nullable=False)
    tenTuyen = db.Column(db.String(100))
    diemBatDau = db.Column(db.String(100))
    diemKetThuc = db.Column(db.String(100))

    chuyen_xes = db.relationship("ChuyenXe", backref="tuyen", lazy=True)
    tram_dungs = db.relationship(
        "TramDung",
        back_populates="tuyen",
        lazy=True,
        order_by="TramDung.thuTuTrenTuyen"
    )


class ChuyenXe(db.Model):
    __tablename__ = "chuyen_xe"
    maChuyen = db.Column(db.Integer, primary_key=True)
    tuyen_id = db.Column(db.Integer, db.ForeignKey("tuyen_xe.maTuyen"))
    ngayKhoiHanh = db.Column(db.String(20))
    gioKhoiHanh = db.Column(db.String(20))

    ve_xe = db.relationship("VeXe", backref="chuyen", lazy=True)


class HoaDon(db.Model):
    __tablename__ = "hoa_don"
    maHoaDon = db.Column(db.Integer, primary_key=True)
    khach_hang_id = db.Column(db.Integer, db.ForeignKey("khach_hang.maKH"))

    # Thuộc tính theo class diagram
    ngayLap = db.Column(db.DateTime, default=datetime.utcnow)
    tongTien = db.Column(db.Float, default=0)
    phuongThucThanhToan = db.Column(db.String(50), default="TIEN_MAT")  # hoặc "ONLINE"
    trangThai = db.Column(db.String(20), default="DA_THANH_TOAN")       # hoặc "CHO_THANH_TOAN"

    ve_xe = db.relationship("VeXe", backref="hoa_don", lazy=True)


class VeXe(db.Model):
    __tablename__ = "ve_xe"
    maVe = db.Column(db.Integer, primary_key=True)
    hoa_don_id = db.Column(db.Integer, db.ForeignKey("hoa_don.maHoaDon"))
    chuyen_id = db.Column(db.Integer, db.ForeignKey("chuyen_xe.maChuyen"))
    soGhe = db.Column(db.String(10))
    giaVe = db.Column(db.Float)

    trangThai = db.Column(db.String(20), default="CON HIEU LUC")


class TheTu(db.Model):
    __tablename__ = "the_tu"
    maThe = db.Column(db.Integer, primary_key=True)
    khach_hang_id = db.Column(db.Integer, db.ForeignKey("khach_hang.maKH"))
    maSoThe = db.Column(db.String(50))
    ngayBatDau = db.Column(db.String(20))
    ngayHetHan = db.Column(db.String(20))

    trangThai = db.Column(db.String(20), default="CON HAN")


class TramDung(db.Model):
    __tablename__ = "tram_dung"

    maTram = db.Column(db.Integer, primary_key=True)
    tenTram = db.Column(db.String(100), nullable=False)
    diaChi = db.Column(db.String(200))
    thuTuTrenTuyen = db.Column(db.Integer, nullable=False)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)

    tuyen_id = db.Column(
        db.Integer,
        db.ForeignKey("tuyen_xe.maTuyen"),
        nullable=False,
    )

    tuyen = db.relationship("TuyenXe", back_populates="tram_dungs")


# ==================== KHỞI TẠO DB & ADMIN ====================

with app.app_context():
    db.create_all()

    # Tạo tài khoản admin mặc định nếu chưa có
    if not TaiKhoan.query.filter_by(vai_tro="ADMIN").first():
        admin = TaiKhoan(
            email="admin@smartbus.local",
            mat_khau_hash=generate_password_hash("admin123"),
            vai_tro="ADMIN"
        )
        db.session.add(admin)
        db.session.commit()


# ==================== HÀM TIỆN ÍCH ====================

def current_user():
    """Trả về đối tượng TaiKhoan đang đăng nhập hoặc None."""
    uid = session.get("user_id")
    if uid is None:
        return None
    # dùng Session.get thay cho Query.get để tránh warning
    return db.session.get(TaiKhoan, uid)

def build_stops_geo(tram_dungs):
    return [
        {
            "id": s.maTram,
            "name": s.tenTram,
            "address": s.diaChi,
            "lat": float(s.lat) if s.lat is not None else None,
            "lng": float(s.lng) if s.lng is not None else None,
            "order": s.thuTuTrenTuyen,
        }
        for s in tram_dungs
    ]

@app.context_processor
def inject_user():
    return dict(user=current_user())


# ==================== TRANG CHÍNH ====================

@app.route("/")
def home():
    user = current_user()
    return render_template("home.html", user=user)


# ==================== ĐĂNG KÝ / ĐĂNG NHẬP ====================

@app.route("/register", methods=["GET", "POST"])
def register():
    # Nếu đã đăng nhập thì không cho đăng ký nữa
    if current_user():
        return redirect(url_for("home"))

    if request.method == "POST":
        full_name = request.form.get("full_name")
        email = request.form.get("email")
        password = request.form.get("password")

        if not email or not password:
            flash("Email và mật khẩu không được để trống.")
            return redirect(url_for("register"))

        existed = TaiKhoan.query.filter_by(email=email).first()
        if existed:
            flash("Email này đã được sử dụng.")
            return redirect(url_for("register"))

        tk = TaiKhoan(
            email=email,
            mat_khau_hash=generate_password_hash(password),
            vai_tro="KHACH"
        )
        db.session.add(tk)
        db.session.flush()

        kh = KhachHang(
            hoTen=full_name,
            tai_khoan_id=tk.id,
            ngayDangKy=datetime.utcnow().strftime("%Y-%m-%d")
        )
        db.session.add(kh)
        db.session.commit()

        flash("Đăng ký thành công, hãy đăng nhập.")
        return redirect(url_for("login"))

    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    # Nếu đã đăng nhập thì quay về trang chủ
    if current_user():
        return redirect(url_for("home"))

    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")

        tk = TaiKhoan.query.filter_by(email=email).first()
        if tk and check_password_hash(tk.mat_khau_hash, password):
            session["user_id"] = tk.id
            session["user_role"] = tk.vai_tro
            flash("Đăng nhập thành công.")
            return redirect(url_for("home"))
        else:
            flash("Sai email hoặc mật khẩu.")

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    flash("Bạn đã đăng xuất.")
    return redirect(url_for("home"))


# ==================== CÁC TRANG KHÁC ====================

@app.route("/routes")
def routes():
    danh_sach_tuyen = TuyenXe.query.all()
    return render_template("routes.html", routes=danh_sach_tuyen)


@app.route("/routes/<int:tuyen_id>")
def route_detail(tuyen_id):
    """Trang public: xem thông tin tuyến + danh sách chuyến + trạm (read-only)."""
    tuyen = TuyenXe.query.get_or_404(tuyen_id)

    danh_sach_chuyen = (
        ChuyenXe.query
        .filter_by(tuyen_id=tuyen.maTuyen)
        .order_by(ChuyenXe.maChuyen)
        .all()
    )
    danh_sach_tram = (
        TramDung.query
        .filter_by(tuyen_id=tuyen.maTuyen)
        .order_by(TramDung.thuTuTrenTuyen)
        .all()
    )

    stops_geo = build_stops_geo(danh_sach_tram)
    return render_template(
        "route_detail.html",
        tuyen = tuyen,
        trips = danh_sach_chuyen,
        stops = danh_sach_tram,
        stops_geo = stops_geo,
    )

from flask import request

@app.route("/trips/<int:trip_id>")
def trip_detail(trip_id):
    user = current_user()
    trip = ChuyenXe.query.get_or_404(trip_id)
    tuyen = TuyenXe.query.get(trip.tuyen_id)

    # nếu URL có ?mode=admin thì hiểu là xem từ trang admin
    is_admin_mode = request.args.get("mode") == "admin"

    return render_template(
        "trip_detail.html",
        trip=trip,
        tuyen=tuyen,
        is_admin_mode=is_admin_mode,
        user=user,
    )


@app.route("/trips/<int:trip_id>/book", methods=["GET", "POST"])
def booking(trip_id):
    user = current_user()
    if not user:
        flash("Bạn phải đăng nhập để đặt vé.")
        return redirect(url_for("login"))

    trip = ChuyenXe.query.get_or_404(trip_id)
    tuyen = trip.tuyen

    # Cấu hình đơn giản
    seat_capacity = 40          # mỗi chuyến 40 ghế, bạn đổi nếu muốn
    gia_mac_dinh = 50000        # giá vé cố định, muốn động thì đọc từ DB
    booked_seats = {ve.soGhe for ve in trip.ve_xe if ve.trangThai != "DA_HUY"}

    if request.method == "POST":
        raw_seats = request.form.get("soGhe", "").strip()
        gia_ve = float(request.form.get("giaVe") or gia_mac_dinh)

        if not raw_seats:
            flash("Bạn phải chọn ít nhất một ghế.")
            return redirect(url_for("booking", trip_id=trip_id))

        # tách chuỗi "01,02,03" -> ["01","02","03"]
        seats = [s.strip() for s in raw_seats.split(",") if s.strip()]
        seats = sorted(set(seats))  # bỏ trùng

        # ghế nào đã bị đặt trước đó?
        already = [s for s in seats if s in booked_seats]
        if already:
            flash("Các ghế đã có người đặt: " + ", ".join(already))
            return redirect(url_for("booking", trip_id=trip_id))

        kh = user.khach_hang
        if not kh:
            flash("Tài khoản của bạn chưa gắn với thông tin khách hàng.")
            return redirect(url_for("home"))

        tong_tien = gia_ve * len(seats)

        # Tạo hóa đơn
        hoa_don = HoaDon(khach_hang=kh, tongTien=tong_tien)
        db.session.add(hoa_don)
        db.session.flush()  # lấy mã hóa đơn

        # Tạo từng vé cho từng ghế
        for seat in seats:
            ve = VeXe(
                hoa_don=hoa_don,
                chuyen=trip,
                soGhe=seat,
                giaVe=gia_ve,
            )
            db.session.add(ve)

        db.session.commit()

        flash(f"Đặt {len(seats)} vé thành công! Mã hóa đơn: {hoa_don.maHoaDon}")
        return redirect(url_for("tickets"))
    return render_template(
        "booking.html",
        trip=trip,
        tuyen=tuyen,
        seat_capacity=seat_capacity,
        booked_seats=booked_seats,
        gia_mac_dinh=gia_mac_dinh,
        user=user,
    )

from flask import abort

@app.route("/tickets/<int:ve_id>/cancel", methods=["POST"])
def cancel_ticket(ve_id):
    user = current_user()
    if not user:
        flash("Bạn cần đăng nhập để hủy vé.")
        return redirect(url_for("login"))

    khach = KhachHang.query.filter_by(tai_khoan_id=user.id).first()
    if not khach:
        flash("Không tìm thấy thông tin khách hàng.")
        return redirect(url_for("home"))

    ve = VeXe.query.get_or_404(ve_id)

    # Bảo vệ: chỉ cho hủy vé thuộc khách hiện tại
    if not ve.hoa_don or ve.hoa_don.khach_hang_id != khach.maKH:
        flash("Bạn không có quyền hủy vé này.")
        return redirect(url_for("tickets"))

    if ve.trangThai == "DA_HUY":
        flash(f"Vé #{ve.maVe} đã được hủy trước đó.")
    else:
        ve.trangThai = "DA_HUY"
        db.session.commit()
        flash(f"Đã hủy vé #{ve.maVe} thành công.")

    return redirect(url_for("tickets"))


@app.route("/tickets")
def tickets():
    user = current_user()
    if not user:
        flash("Bạn cần đăng nhập để xem vé đã đặt.")
        return redirect(url_for("login"))

    khach = KhachHang.query.filter_by(tai_khoan_id=user.id).first()
    if not khach:
        flash("Không tìm thấy thông tin khách hàng.")
        return redirect(url_for("home"))

    # Lấy trực tiếp danh sách VeXe, dùng quan hệ chuyen ↔ hoa_don ↔ tuyen
    tickets = (
        VeXe.query
        .join(HoaDon, VeXe.hoa_don_id == HoaDon.maHoaDon)
        .join(ChuyenXe, VeXe.chuyen_id == ChuyenXe.maChuyen)
        .join(TuyenXe, ChuyenXe.tuyen_id == TuyenXe.maTuyen)
        .filter(HoaDon.khach_hang_id == khach.maKH)
        .order_by(VeXe.maVe.desc())
        .all()
    )

    return render_template("tickets.html", tickets=tickets)




@app.route("/card-register")
def card_register():
    return render_template("card_register.html")


# ==================== ADMIN ====================

@app.route("/admin/routes", methods=["GET", "POST"])
def admin_routes():
    user = current_user()
    if not user or user.vai_tro != "ADMIN":
        flash("Bạn không có quyền truy cập!")
        return redirect(url_for("home"))

    if request.method == "POST":
        ma_tuyen_display = request.form.get("maHienThi")
        ten_tuyen = request.form.get("tenTuyen")
        diem_bd = request.form.get("diemBatDau")
        diem_kt = request.form.get("diemKetThuc")

        if ten_tuyen and ma_tuyen_display:
            tuyen = TuyenXe.query.filter_by(maHienThi=ma_tuyen_display).first()
            if tuyen:
                tuyen.tenTuyen = ten_tuyen
                tuyen.diemBatDau = diem_bd
                tuyen.diemKetThuc = diem_kt
                flash("Đã cập nhật tuyến cũ thành công!")
            else:
                tuyen = TuyenXe(
                    maHienThi=ma_tuyen_display,
                    tenTuyen=ten_tuyen,
                    diemBatDau=diem_bd,
                    diemKetThuc=diem_kt,
                )
                db.session.add(tuyen)
                flash("Đã thêm vào tuyến mới thành công!")
            db.session.commit()
        else:
            flash("Mã tuyến và tên tuyến không được để trống!")

        return redirect(url_for("admin_routes"))

    danh_sach_tuyen = TuyenXe.query.order_by(TuyenXe.maTuyen).all()
    return render_template("admin_routes.html", routes=danh_sach_tuyen)

@app.route("/admin/routes/<int:tuyen_id>/stops", methods=["GET", "POST"])
def admin_route_stops(tuyen_id):
    """Quản lý trạm dừng cho từng tuyến (admin)."""
    user = current_user()
    if not user or user.vai_tro != "ADMIN":
        flash("Bạn không có quyền truy cập!")
        return redirect(url_for("home"))

    tuyen = TuyenXe.query.get_or_404(tuyen_id)

    if request.method == "POST":
        ma_tram = request.form.get("maTram")  # để sửa, có thể rỗng nếu thêm mới
        ten_tram = request.form.get("tenTram")
        dia_chi = request.form.get("diaChi")
        # ĐỌC ĐÚNG TÊN FIELD TRONG FORM
        thu_tu = request.form.get("thuTuTrenTuyen")
        lat = request.form.get("lat")
        lng = request.form.get("lng")

        if not ten_tram or not lat or not lng or not thu_tu:
            flash("Vui lòng nhập đầy đủ tên trạm, vị trí và thứ tự.")
            # ĐÚNG TÊN ENDPOINT
            return redirect(url_for("admin_route_stops", tuyen_id=tuyen_id))

        if ma_tram:
            tram = TramDung.query.get(ma_tram)
            if tram and tram.tuyen_id == tuyen_id:
                tram.tenTram = ten_tram
                tram.diaChi = dia_chi
                tram.thuTuTrenTuyen = int(thu_tu)
                tram.lat = float(lat)
                tram.lng = float(lng)
                flash("Đã cập nhật trạm dừng.")
        else:
            tram = TramDung(
                tenTram=ten_tram,
                diaChi=dia_chi,
                thuTuTrenTuyen=int(thu_tu),
                lat=float(lat),
                lng=float(lng),
                tuyen_id=tuyen_id,
            )
            db.session.add(tram)
            flash("Đã thêm trạm dừng mới.")

        db.session.commit()
        # ĐÚNG TÊN ENDPOINT
        return redirect(url_for("admin_route_stops", tuyen_id=tuyen_id))

    danh_sach_tram = (
        TramDung.query
        .filter_by(tuyen_id=tuyen_id)
        .order_by(TramDung.thuTuTrenTuyen)
        .all()
    )
    stops_geo = build_stops_geo(danh_sach_tram)

    return render_template(
        "admin_stops.html",
        tuyen=tuyen,
        stops=danh_sach_tram,
        stops_geo=stops_geo,
    )

@app.route("/admin/routes/<int:tuyen_id>/trips", methods=["GET", "POST"])
def admin_route_trips(tuyen_id):
    """
    Quản lý các chuyến xe của một tuyến (admin).
    URL dạng /admin/routes/<tuyen_id>/trips
    """
    user = current_user()
    if not user or user.vai_tro != "ADMIN":
        flash("Bạn không có quyền truy cập trang quản trị.")
        return redirect(url_for("home"))

    tuyen = TuyenXe.query.get_or_404(tuyen_id)

    if request.method == "POST":
        action = request.form.get("action", "add_trip")

        if action == "add_trip":
            ngay = request.form.get("ngayKhoiHanh")
            gio = request.form.get("gioKhoiHanh")

            if not ngay or not gio:
                flash("Ngày và giờ khởi hành không được để trống.")
            else:
                trip = ChuyenXe(
                    tuyen_id=tuyen.maTuyen,
                    ngayKhoiHanh=ngay,
                    gioKhoiHanh=gio,
                )
                db.session.add(trip)
                db.session.commit()
                flash("Đã thêm chuyến mới.")

        elif action == "delete_trip":
            trip_id = request.form.get("trip_id")
            if trip_id:
                trip = ChuyenXe.query.get(int(trip_id))
                if trip and trip.tuyen_id == tuyen.maTuyen:
                    db.session.delete(trip)
                    db.session.commit()
                    flash("Đã xóa chuyến xe.")

        return redirect(url_for("admin_route_trips", tuyen_id=tuyen_id))

    # GET: hiển thị danh sách chuyến + trạm (để vẽ map, nhưng không chỉnh sửa trạm ở đây)
    danh_sach_chuyen = (
        ChuyenXe.query
        .filter_by(tuyen_id=tuyen.maTuyen)
        .order_by(ChuyenXe.maChuyen)
        .all()
    )
    danh_sach_tram = (
        TramDung.query
        .filter_by(tuyen_id=tuyen.maTuyen)
        .order_by(TramDung.thuTuTrenTuyen)
        .all()
    )
    stops_geo = build_stops_geo(danh_sach_tram)
    return render_template(
        "admin_trips.html",
        tuyen=tuyen,
        trips=danh_sach_chuyen,
        stops=danh_sach_tram,
        stops_geo = stops_geo,
    )

@app.route("/admin/routes/<int:tuyen_id>/delete", methods=["POST"])
def delete_route(tuyen_id):
    user = current_user()
    if not user or user.vai_tro != "ADMIN":
        flash("Bạn không có quyền truy cập!")
        return redirect(url_for("home"))

    tuyen = TuyenXe.query.get_or_404(tuyen_id)

    # Nếu còn chuyến hoặc trạm thì không cho xóa
    if tuyen.chuyen_xes or tuyen.tram_dungs:
        flash("Không thể xóa tuyến vì vẫn còn chuyến xe hoặc trạm dừng. "
              "Hãy xóa hết chuyến và trạm trước.")
        return redirect(url_for("admin_routes"))

    db.session.delete(tuyen)
    db.session.commit()
    flash(f"Đã xóa tuyến {tuyen.maHienThi}.")

    return redirect(url_for("admin_routes"))

@app.route("/admin/trips/<int:trip_id>/delete", methods=["POST"])
def delete_trip(trip_id):
    user = current_user()
    if not user or user.vai_tro != "ADMIN":
        flash("Bạn không có quyền truy cập!")
        return redirect(url_for("home"))

    trip = ChuyenXe.query.get_or_404(trip_id)
    tuyen_id = trip.tuyen_id

    # Nếu chuyến đã có vé thì không cho xóa (tránh lỗi dữ liệu)
    if trip.ve_xe:
        flash("Không thể xóa chuyến vì đã có vé được đặt.")
        return redirect(url_for("admin_route_trips", tuyen_id=tuyen_id))

    db.session.delete(trip)
    db.session.commit()
    flash(f"Đã xóa chuyến #{trip.maChuyen}.")

    return redirect(url_for("admin_route_trips", tuyen_id=tuyen_id))


# ==================== MAIN ====================

if __name__ == "__main__":
    app.run(debug=True)
