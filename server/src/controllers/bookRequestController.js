import { randomUUID } from 'node:crypto';
import { YeuCauBoSungSach, Sach } from '../models/index.js';
import { normalize } from '../services/search.js';

export async function create(req, res) {
  const { title, author = '', isbn = '', reason } = req.body;
  if (
    typeof title !== 'string' ||
    !title.trim() ||
    title.trim().length > 200 ||
    typeof author !== 'string' ||
    author.trim().length > 200 ||
    typeof isbn !== 'string' ||
    isbn.trim().length > 32 ||
    typeof reason !== 'string' ||
    !reason.trim() ||
    reason.trim().length > 2000
  )
    return res
      .status(400)
      .json({
        message:
          'Nhập tên sách (tối đa 200 ký tự), lý do (tối đa 2.000 ký tự). Tác giả tối đa 200 và ISBN tối đa 32 ký tự.',
      });
  const key = (value) =>
    normalize(value)
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  try {
    const request = await YeuCauBoSungSach.create({
      MaYeuCau: 'YC-' + randomUUID().toUpperCase(),
      MaDocGia: req.user.id,
      TenSach: title.trim(),
      TacGia: author.trim(),
      ISBN: isbn.trim(),
      LyDo: reason.trim(),
      KhoaTrung: key(title) + '|' + key(author),
    });
    const result = request.toObject();
    delete result.KhoaTrung;
    res.status(201).json(result);
  } catch (error) {
    if (error.code === 11000)
      return res
        .status(409)
        .json({ message: 'Bạn đã có phiếu yêu cầu cuốn sách này đang chờ xử lý.' });
    throw error;
  }
}

export async function list(req, res) {
  res.json(
    await YeuCauBoSungSach.find(req.user.role === 'Reader' ? { MaDocGia: req.user.id } : {})
      .populate('MaDocGia', 'MaDocGia HoLot Ten Email')
      .populate('NhanVien', 'HoTenNV')
      .populate('MaSach', 'MaSach TenSach SoQuyen NguonGocTacGia')
      .sort({ createdAt: -1 }),
  );
}

export async function update(req, res) {
  const request = await YeuCauBoSungSach.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Không tìm thấy phiếu yêu cầu.' });
  const reader = req.user.role === 'Reader';
  let changes;
  if (reader) {
    if (String(request.MaDocGia) !== req.user.id || req.body.action !== 'cancel')
      return res.status(403).json({ message: 'Bạn chỉ được hủy phiếu của mình.' });
    if (request.TrangThai !== 'Moi')
      return res
        .status(409)
        .json({ message: 'Chỉ có thể hủy phiếu mới, chưa được thủ thư xem xét.' });
    changes = { TrangThai: 'DaHuy', NgayXuLy: new Date() };
  } else {
    const { status, response = '', bookId } = req.body;
    const transitions = {
      Moi: ['DangXemXet', 'DaBoSung', 'TuChoi'],
      DangXemXet: ['DaBoSung', 'TuChoi'],
    };
    if (
      !['DangXemXet', 'DaBoSung', 'TuChoi'].includes(status) ||
      typeof response !== 'string' ||
      response.trim().length > 2000
    )
      return res.status(400).json({ message: 'Trạng thái hoặc phản hồi không hợp lệ.' });
    if (!transitions[request.TrangThai]?.includes(status))
      return res
        .status(409)
        .json({ message: 'Phiếu đã hoàn tất, bị hủy hoặc trạng thái không còn phù hợp.' });
    if (['DaBoSung', 'TuChoi'].includes(status) && !response.trim())
      return res
        .status(400)
        .json({ message: 'Ghi phản hồi cho độc giả trước khi hoàn tất phiếu.' });
    if (status === 'DaBoSung' && (!bookId || !(await Sach.exists({ _id: bookId }))))
      return res
        .status(400)
        .json({ message: 'Chọn sách đã được thêm vào danh mục trước khi xác nhận bổ sung.' });
    changes = {
      TrangThai: status,
      PhanHoi: response.trim(),
      NhanVien: req.user.id,
      NgayXuLy: new Date(),
      MaSach: status === 'DaBoSung' ? bookId : null,
    };
  }
  const updated = await YeuCauBoSungSach.findOneAndUpdate(
    { _id: request._id, TrangThai: request.TrangThai },
    { $set: changes },
    { new: true, runValidators: true },
  );
  if (!updated)
    return res.status(409).json({ message: 'Phiếu vừa được cập nhật. Vui lòng tải lại.' });
  res.json(updated);
}
