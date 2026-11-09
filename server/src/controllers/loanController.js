import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { Sach, TheoDoiMuonSach, DocGia, NhanVien, BaoCaoSach } from '../models/index.js';
import { fineFor } from '../services/search.js';
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export async function request(req, res) {
  const { borrowDate, returnDate, responsibility } = req.body;
  const validDay = (value) =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  if (
    !validDay(borrowDate) ||
    !validDay(returnDate) ||
    borrowDate < today ||
    returnDate <= borrowDate ||
    Date.parse(returnDate) - Date.parse(borrowDate) > 14 * 86400000 ||
    responsibility !== true
  )
    throw fail(
      'Chọn ngày mượn từ hôm nay, ngày trả sau ngày mượn (tối đa 14 ngày) và xác nhận trách nhiệm.',
    );
  if (!(await Sach.exists({ _id: req.body.bookId }))) throw fail('Sách không tồn tại.', 404);
  const debt = await TheoDoiMuonSach.exists({
    MaDocGia: req.user.id,
    TrangThai: 'DaTra',
    DaThanhToan: false,
    $or: [{ TienPhat: { $gt: 0 } }, { TienBoiThuong: { $gt: 0 } }],
  });
  if (debt) throw fail('Vui lòng thanh toán khoản phạt trước khi mượn thêm sách.');
  const loan = await TheoDoiMuonSach.create({
    MaDocGia: req.user.id,
    MaSach: req.body.bookId,
    NgayMuonDuKien: new Date(borrowDate + 'T00:00:00+07:00'),
    NgayTraDuKien: new Date(returnDate + 'T23:59:59.999+07:00'),
    XacNhanTrachNhiem: true,
  });
  res.status(201).json(loan);
}
export async function list(req, res) {
  const rows = await TheoDoiMuonSach.find(
    req.user.role === 'Reader' ? { MaDocGia: req.user.id } : {},
  )
    .populate('MaSach')
    .populate('MaDocGia', 'MaDocGia HoLot Ten Email')
    .populate('NhanVien', 'HoTenNV')
    .sort({ createdAt: -1 })
    .lean();
  res.json(
    rows.map((l) => ({
      ...l,
      PhatHienTai:
        l.TrangThai === 'DangMuon'
          ? fineFor(l.HanTra, new Date(), Number(process.env.FINE_PER_DAY || 5000))
          : l.TienPhat,
    })),
  );
}
export async function action(req, res) {
  const { action } = req.body;
  let result;
  await mongoose.connection.transaction(async (session) => {
    const loan = await TheoDoiMuonSach.findById(req.params.id).session(session);
    if (!loan) throw fail('Không tìm thấy phiếu.', 404);
    const reader = req.user.role === 'Reader';
    if (reader && (String(loan.MaDocGia) !== req.user.id || action !== 'cancel'))
      throw fail('Không có quyền thao tác.', 403);
    if (['approve', 'handover'].includes(action)) {
      const profile = await DocGia.findById(loan.MaDocGia).session(session);
      if (!profile || profile.BiKhoa) throw fail('Độc giả đã bị khóa hoặc không còn tồn tại.');
    }
    if (action === 'approve') {
      if (loan.TrangThai !== 'ChoDuyet') throw fail('Phiếu không còn chờ duyệt.');
      const book = await Sach.findOneAndUpdate(
        { _id: loan.MaSach, SoQuyen: { $gt: 0 } },
        { $inc: { SoQuyen: -1 } },
        { new: true, session },
      );
      if (!book) throw fail('Sách đã hết bản có thể mượn.');
      if (!loan.NgayTraDuKien || loan.NgayTraDuKien < new Date())
        throw fail('Lịch đăng ký đã hết hạn. Vui lòng từ chối và yêu cầu đăng ký lại.');
      loan.TrangThai = 'ChoNhan';
      loan.MaPhieu = 'PM-' + randomUUID().toUpperCase();
      loan.HanTra = loan.NgayTraDuKien;
      loan.NhanVien = req.user.id;
    } else if (action === 'handover') {
      if (loan.TrangThai !== 'ChoNhan') throw fail('Phiếu không ở trạng thái chờ nhận sách.');
      if (typeof req.body.code !== 'string' || req.body.code.trim().toUpperCase() !== loan.MaPhieu)
        throw fail('Mã phiếu không khớp.');
      const now = new Date();
      if (now < loan.NgayMuonDuKien || now > loan.HanTra)
        throw fail('Chưa đến ngày nhận hoặc đã quá hạn đăng ký.');
      loan.TrangThai = 'DangMuon';
      loan.NgayMuon = now;
      loan.NgayGiao = now;
      loan.NhanVien = req.user.id;
      await Sach.updateOne({ _id: loan.MaSach }, { $inc: { LuotMuon: 1 } }, { session });
    } else if (action === 'reject' || action === 'cancel') {
      if (!['ChoDuyet', 'ChoNhan'].includes(loan.TrangThai))
        throw fail('Chỉ có thể hủy hoặc từ chối phiếu chưa giao sách.');
      if (loan.TrangThai === 'ChoNhan')
        await Sach.updateOne({ _id: loan.MaSach }, { $inc: { SoQuyen: 1 } }, { session });
      loan.TrangThai = action === 'cancel' ? 'DaHuy' : 'TuChoi';
    } else if (action === 'return') {
      if (loan.TrangThai !== 'DangMuon') throw fail('Phiếu không ở trạng thái đang mượn.');
      const condition = req.body.condition || 'Bình thường';
      if (!['Bình thường', 'Hỏng', 'Mất'].includes(condition))
        throw fail('Tình trạng sách không hợp lệ.');
      const amount = Number(req.body.compensation || 0);
      if (!Number.isFinite(amount) || amount < 0 || (condition === 'Bình thường' && amount !== 0))
        throw fail('Tiền bồi thường không hợp lệ.');
      loan.NgayTra = new Date();
      loan.TienPhat = fineFor(loan.HanTra, loan.NgayTra, Number(process.env.FINE_PER_DAY || 5000));
      loan.TinhTrangTra = condition;
      loan.TienBoiThuong = amount;
      loan.GhiChu = String(req.body.note || '').slice(0, 1000);
      loan.TrangThai = 'DaTra';
      loan.NhanVien = req.user.id;
      if (condition === 'Bình thường')
        await Sach.updateOne({ _id: loan.MaSach }, { $inc: { SoQuyen: 1 } }, { session });
    } else if (action === 'pay') {
      if (loan.TrangThai !== 'DaTra' || loan.DaThanhToan || loan.TienPhat + loan.TienBoiThuong <= 0)
        throw fail('Không có khoản phí cần thu.');
      loan.DaThanhToan = true;
    } else throw fail('Thao tác không hợp lệ.');
    await loan.save({ session });
    result = loan;
  });
  res.json(result);
}
export async function overview(req, res) {
  const [books, readers, loans, staff, inventory, pendingReports] = await Promise.all([
    Sach.countDocuments(),
    DocGia.countDocuments(),
    TheoDoiMuonSach.find().lean(),
    NhanVien.countDocuments(),
    Sach.aggregate([
      {
        $group: {
          _id: '$TheLoai',
          titles: { $sum: 1 },
          available: { $sum: '$SoQuyen' },
          borrowed: { $sum: '$LuotMuon' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    BaoCaoSach.countDocuments({ TrangThai: { $ne: 'DaXuLy' } }),
  ]);
  res.json({
    books,
    readers,
    staff,
    inventory,
    available: inventory.reduce((sum, row) => sum + row.available, 0),
    pendingReports,
    pending: loans.filter((l) => l.TrangThai === 'ChoDuyet').length,
    awaitingPickup: loans.filter((l) => l.TrangThai === 'ChoNhan').length,
    borrowing: loans.filter((l) => l.TrangThai === 'DangMuon').length,
    overdue: loans.filter((l) => l.TrangThai === 'DangMuon' && l.HanTra < new Date()).length,
    debt: loans
      .filter((l) => !l.DaThanhToan && l.TrangThai === 'DaTra')
      .reduce((n, l) => n + l.TienPhat + l.TienBoiThuong, 0),
  });
}
export async function readers(req, res) {
  res.json(await DocGia.find().sort({ createdAt: -1 }));
}
