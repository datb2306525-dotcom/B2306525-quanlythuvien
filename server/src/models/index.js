import { genresOf } from '../../../shared/genres.js';
import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const str = { type: String, trim: true, required: true };
const options = (collection) => ({ collection, timestamps: true });
const publisher = new Schema(
  { MaNXB: { ...str, unique: true }, TenNXB: str, DiaChi: str },
  options('NHAXUATBAN'),
);
const book = new Schema(
  {
    MaSach: { ...str, unique: true },
    TenSach: str,
    DonGia: { type: Number, min: 0, required: true },
    SoQuyen: { type: Number, min: 0, required: true },
    NamXuatBan: { type: Number, required: true },
    MaNXB: { type: Schema.Types.ObjectId, ref: 'NhaXuatBan', required: true },
    NguonGocTacGia: str,
    TheLoai: {
      set: genresOf,
      type: [{ type: String, trim: true, minlength: 1, maxlength: 100 }],
      required: true,
      validate: {
        validator: (values) => values.length > 0 && new Set(values).size === values.length,
        message: 'Chọn ít nhất một thể loại, không để trùng.',
      },
    },
    DanhMuc: { type: String, trim: true, default: 'Sách tham khảo' },
    AnhBia: { type: String, default: '' },
    MoTa: { type: String, default: '' },
    MauBia: { type: String, default: '#34576b' },
    LuotMuon: { type: Number, default: 0 },
  },
  options('SACH'),
);
const reader = new Schema(
  {
    MaDocGia: { ...str, unique: true },
    HoLot: str,
    Ten: str,
    NgaySinh: { type: Date, required: true },
    Phai: { type: String, enum: ['Nam', 'Nữ', 'Khác'], required: true },
    DiaChi: str,
    DienThoai: str,
    Email: { ...str, lowercase: true, unique: true },
    GoogleId: { type: String, unique: true, sparse: true, select: false },
    FacebookId: { type: String, unique: true, sparse: true, select: false },
    Password: {
      type: String,
      required: function () {
        return !this.GoogleId && !this.FacebookId;
      },
      select: false,
    },
    BiKhoa: { type: Boolean, default: false },
    LyDoKhoa: { type: String, default: '', maxlength: 1000 },
    LoaiDocGia: { type: String, enum: ['Sinh viên', 'Giảng viên'], default: 'Sinh viên' },
  },
  options('DOCGIA'),
);
const staff = new Schema(
  {
    MSNV: { ...str, unique: true },
    HoTenNV: str,
    Password: { type: String, required: true, select: false },
    ChucVu: { type: String, enum: ['Admin', 'Librarian'], default: 'Librarian' },
    DiaChi: str,
    SoDienThoai: str,
    Email: { ...str, lowercase: true, unique: true },
  },
  options('NhanVien'),
);
const loan = new Schema(
  {
    MaDocGia: { type: Schema.Types.ObjectId, ref: 'DocGia', required: true },
    MaSach: { type: Schema.Types.ObjectId, ref: 'Sach', required: true },
    NgayMuon: { type: Date, required: true, default: Date.now },
    NgayTra: { type: Date, default: null },
    NgayMuonDuKien: { type: Date, default: null },
    NgayTraDuKien: { type: Date, default: null },
    NgayGiao: { type: Date, default: null },
    XacNhanTrachNhiem: { type: Boolean, default: false },
    MaPhieu: { type: String, unique: true, sparse: true },
    HanTra: { type: Date, default: null },
    TrangThai: {
      type: String,
      enum: ['ChoDuyet', 'ChoNhan', 'DangMuon', 'DaTra', 'TuChoi', 'DaHuy'],
      default: 'ChoDuyet',
    },
    NhanVien: { type: Schema.Types.ObjectId, ref: 'NhanVien', default: null },
    TienPhat: { type: Number, default: 0, min: 0 },
    TienBoiThuong: { type: Number, default: 0, min: 0 },
    TinhTrangTra: { type: String, enum: ['Bình thường', 'Hỏng', 'Mất'], default: 'Bình thường' },
    GhiChu: { type: String, default: '' },
    DaThanhToan: { type: Boolean, default: false },
  },
  options('THEODOIMUONSACH'),
);
loan.index(
  { MaDocGia: 1, MaSach: 1 },
  {
    unique: true,
    partialFilterExpression: { TrangThai: { $in: ['ChoDuyet', 'ChoNhan', 'DangMuon'] } },
  },
);
export const NhaXuatBan = model('NhaXuatBan', publisher);
export const Sach = model('Sach', book);
export const DocGia = model('DocGia', reader);
export const NhanVien = model('NhanVien', staff);
export const TheoDoiMuonSach = model('TheoDoiMuonSach', loan);
const bookRequest = new Schema(
  {
    MaYeuCau: { ...str, unique: true },
    MaDocGia: { type: Schema.Types.ObjectId, ref: 'DocGia', required: true },
    TenSach: { ...str, maxlength: 200 },
    TacGia: { type: String, trim: true, default: '', maxlength: 200 },
    ISBN: { type: String, trim: true, default: '', maxlength: 32 },
    LyDo: { ...str, maxlength: 2000 },
    KhoaTrung: { ...str, select: false },
    TrangThai: {
      type: String,
      enum: ['Moi', 'DangXemXet', 'DaBoSung', 'TuChoi', 'DaHuy'],
      default: 'Moi',
    },
    PhanHoi: { type: String, trim: true, default: '', maxlength: 2000 },
    MaSach: { type: Schema.Types.ObjectId, ref: 'Sach', default: null },
    NhanVien: { type: Schema.Types.ObjectId, ref: 'NhanVien', default: null },
    NgayXuLy: { type: Date, default: null },
  },
  options('YEUCAUBOSUNGSACH'),
);
bookRequest.index(
  { MaDocGia: 1, KhoaTrung: 1 },
  {
    unique: true,
    partialFilterExpression: { TrangThai: { $in: ['Moi', 'DangXemXet'] } },
  },
);
export const YeuCauBoSungSach = model('YeuCauBoSungSach', bookRequest);
export const BaoCaoSach = model(
  'BaoCaoSach',
  new Schema(
    {
      MaSach: { type: Schema.Types.ObjectId, ref: 'Sach', required: true },
      MaDocGia: { type: Schema.Types.ObjectId, ref: 'DocGia', required: true },
      NoiDung: { ...str, maxlength: 2000 },
      TrangThai: { type: String, enum: ['Moi', 'DangXuLy', 'DaXuLy'], default: 'Moi' },
      PhanHoi: { type: String, default: '', maxlength: 2000 },
      NhanVien: { type: Schema.Types.ObjectId, ref: 'NhanVien', default: null },
    },
    options('BAOCAOSACH'),
  ),
);

export const OAuthTicket = model(
  'OAuthTicket',
  new Schema(
    {
      _id: { type: String },
      kind: { type: String, enum: ['state', 'exchange', 'signup'], required: true },
      binding: { type: String, required: true },
      data: { type: Schema.Types.Mixed, required: true },
      expiresAt: { type: Date, required: true, expires: 0 },
    },
    { collection: 'OAUTH_TICKETS' },
  ),
);
