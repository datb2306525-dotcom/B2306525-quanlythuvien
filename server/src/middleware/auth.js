import jwt from 'jsonwebtoken';
import { DocGia, NhanVien } from '../models/index.js';
export function auth(roles = []) {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer /, '');
      const claims = jwt.verify(token, process.env.JWT_SECRET);
      const user = await (claims.role === 'Reader' ? DocGia : NhanVien).findById(claims.id);
      if (!user) return res.status(401).json({ message: 'Tài khoản không tồn tại.' });
      if (claims.role === 'Reader' && user.BiKhoa)
        return res
          .status(403)
          .json({
            message: 'Tài khoản đã bị khóa. ' + (user.LyDoKhoa || 'Vui lòng liên hệ thư viện.'),
          });
      const role = claims.role === 'Reader' ? 'Reader' : user.ChucVu;
      if (roles.length && !roles.includes(role))
        return res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này.' });
      req.user = { id: user.id, role, profile: user };
      next();
    } catch {
      return res.status(401).json({ message: 'Vui lòng đăng nhập lại.' });
    }
  };
}
