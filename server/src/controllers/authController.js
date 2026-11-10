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
