import { BaoCaoSach, Sach } from '../models/index.js';

export async function create(req, res) {
  const { bookId, content } = req.body;
  if (typeof content !== 'string' || !content.trim() || content.length > 2000)
    return res.status(400).json({ message: 'Nội dung cần từ 1 đến 2.000 ký tự.' });
  if (!(await Sach.exists({ _id: bookId })))
    return res.status(404).json({ message: 'Sách không tồn tại.' });
  const report = await BaoCaoSach.create({
    MaSach: bookId,
    MaDocGia: req.user.id,
    NoiDung: content.trim(),
  });
  res.status(201).json(report);
}

export async function list(req, res) {
  res.json(
    await BaoCaoSach.find(req.user.role === 'Reader' ? { MaDocGia: req.user.id } : {})
      .populate('MaSach', 'MaSach TenSach')
      .populate('MaDocGia', 'HoLot Ten Email')
      .populate('NhanVien', 'HoTenNV')
      .sort({ createdAt: -1 }),
  );
}

export async function update(req, res) {
  const { status, response } = req.body;
  if (
    !['Moi', 'DangXuLy', 'DaXuLy'].includes(status) ||
    typeof response !== 'string' ||
    response.length > 2000
  )
    return res.status(400).json({ message: 'Trạng thái hoặc nội dung phản hồi không hợp lệ.' });
  if (status === 'DaXuLy' && !response.trim())
    return res.status(400).json({ message: 'Cần ghi kết quả trước khi hoàn tất xử lý.' });
  const report = await BaoCaoSach.findByIdAndUpdate(
    req.params.id,
    {
      TrangThai: status,
      PhanHoi: response.trim(),
      NhanVien: req.user.id,
    },
    { new: true, runValidators: true },
  );
  if (!report) return res.status(404).json({ message: 'Không tìm thấy báo cáo.' });
  res.json(report);
}
