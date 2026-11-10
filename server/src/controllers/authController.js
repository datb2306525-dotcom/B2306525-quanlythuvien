import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { DocGia, NhanVien } from '../models/index.js';
export function session(user, role) {
  return {
    token: jwt.sign({ id: user.id, role }, process.env.JWT_SECRET, { expiresIn: '8h' }),
    user: {
      id: user.id,
      role,
      name: role === 'Reader' ? `${user.HoLot} ${user.Ten}` : user.HoTenNV,
      email: user.Email,
    },
  };
}
export async function register(req, res) {
  const { Email, Password, HoLot, Ten, NgaySinh, Phai, DiaChi, DienThoai, LoaiDocGia } = req.body;
  if (typeof Password !== 'string' || Password.length < 8)
    return res.status(400).json({ message: 'Mật khẩu cần ít nhất 8 ký tự.' });
  if (!/^\S+@\S+\.\S+$/.test(Email || ''))
    return res.status(400).json({ message: 'Email không hợp lệ.' });
  const user = await DocGia.create({
    MaDocGia: 'DG' + randomUUID().slice(0, 8),
    Email,
    Password: await bcrypt.hash(Password, 12),
    HoLot,
    Ten,
    NgaySinh,
    Phai,
    DiaChi,
    DienThoai,
    LoaiDocGia,
  });
  res.status(201).json(session(user, 'Reader'));
}
export async function login(req, res) {
  const staff = req.body.portal === 'admin';
  const email = String(req.body.email || '')
    .toLowerCase()
    .trim();
  const user = await (staff ? NhanVien : DocGia).findOne({ Email: email }).select('+Password');
  if (
    !user ||
    !user.Password ||
    !(await bcrypt.compare(String(req.body.password || ''), user.Password))
  )
    return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
  if (!staff && user.BiKhoa)
    return res.status(403).json({ message: 'Tài khoản đã bị khóa. ' + user.LyDoKhoa });
  res.json(session(user, staff ? user.ChucVu : 'Reader'));
}

export async function lockReader(req, res) {
  const { locked, reason } = req.body;
  if (
    typeof locked !== 'boolean' ||
    (locked && (typeof reason !== 'string' || !reason.trim() || reason.length > 1000))
  )
    return res.status(400).json({ message: 'Cần nhập lý do khóa tài khoản (tối đa 1.000 ký tự).' });
  const user = await DocGia.findByIdAndUpdate(
    req.params.id,
    { BiKhoa: locked, LyDoKhoa: locked ? reason.trim() : '' },
    { new: true, runValidators: true },
  );
  if (!user) return res.status(404).json({ message: 'Không tìm thấy độc giả.' });
  res.json(user);
}

const profileFields = [
  'MaDocGia',
  'HoLot',
  'Ten',
  'Email',
  'NgaySinh',
  'Phai',
  'DiaChi',
  'DienThoai',
  'LoaiDocGia',
];
const editableProfileFields = [
  'HoLot',
  'Ten',
  'NgaySinh',
  'Phai',
  'DiaChi',
  'DienThoai',
  'LoaiDocGia',
];
function publicProfile(reader) {
  return Object.fromEntries(profileFields.map((key) => [key, reader[key]]));
}
export async function profile(req, res) {
  res.json(publicProfile(req.user.profile));
}
export async function updateProfile(req, res) {
  const data = Object.fromEntries(
    editableProfileFields
      .filter((key) => req.body[key] !== undefined)
      .map((key) => [key, req.body[key]]),
  );
  if (!Object.keys(data).length)
    return res.status(400).json({ message: 'Không có thông tin cần cập nhật.' });
  for (const key of ['HoLot', 'Ten', 'DiaChi', 'DienThoai']) {
    if (
      data[key] !== undefined &&
      (typeof data[key] !== 'string' ||
        !data[key].trim() ||
        data[key].length > (key === 'DiaChi' ? 500 : 100))
    )
      return res
        .status(400)
        .json({ message: 'Họ tên, địa chỉ và điện thoại không được để trống hoặc quá dài.' });
  }
  if (data.NgaySinh !== undefined) {
    const date =
      typeof data.NgaySinh === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.NgaySinh)
        ? new Date(data.NgaySinh)
        : new Date(NaN);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== data.NgaySinh ||
      date > new Date()
    )
      return res.status(400).json({ message: 'Ngày sinh không hợp lệ.' });
  }
  const reader = await DocGia.findByIdAndUpdate(
    req.user.id,
    { $set: data },
    { new: true, runValidators: true },
  );
  if (!reader) return res.status(404).json({ message: 'Không tìm thấy tài khoản.' });
  res.json({
    profile: publicProfile(reader),
    user: {
      id: reader.id,
      role: 'Reader',
      name: reader.HoLot + ' ' + reader.Ten,
      email: reader.Email,
    },
  });
}
