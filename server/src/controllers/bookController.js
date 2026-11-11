import { genresOf, genreLabel, matchesGenre } from '../../../shared/genres.js';
import { Sach, NhaXuatBan, TheoDoiMuonSach } from '../models/index.js';
import { normalize } from '../services/search.js';
import { converse } from '../services/athena.js';
import { aiConfiguration } from '../services/gemini.js';
export async function list(req, res) {
  const books = await Sach.find().populate('MaNXB').sort({ createdAt: -1 }).lean();
  const q = normalize(req.query.q);
  res.json(
    books.filter(
      (b) =>
        (!q ||
          normalize(
            `${b.TenSach} ${b.NguonGocTacGia} ${genreLabel(b.TheLoai)} ${b.DanhMuc || ''}`,
          ).includes(q)) &&
        (!req.query.category || matchesGenre(b.TheLoai, req.query.category)) &&
        (!req.query.catalog || b.DanhMuc === req.query.catalog) &&
        (!req.query.publisher || String(b.MaNXB?._id) === req.query.publisher),
    ),
  );
}
export async function detail(req, res) {
  const b = await Sach.findById(req.params.id).populate('MaNXB');
  if (!b) return res.status(404).json({ message: 'Không tìm thấy sách.' });
  res.json(b);
}
const fields = [
  'MaSach',
  'TenSach',
  'DonGia',
  'SoQuyen',
  'NamXuatBan',
  'MaNXB',
  'NguonGocTacGia',
  'TheLoai',
  'MoTa',
  'MauBia',
  'DanhMuc',
  'AnhBia',
];
export async function save(req, res) {
  const data = Object.fromEntries(
    fields.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]),
  );
  if (data.TheLoai !== undefined) {
    const raw = typeof data.TheLoai === 'string' ? [data.TheLoai] : data.TheLoai;
    const values = genresOf(data.TheLoai);
    if (
      !Array.isArray(raw) ||
      raw.some((v) => typeof v !== 'string') ||
      !values.length ||
      values.some((v) => typeof v !== 'string' || !v.trim() || v.trim().length > 100)
    )
      return res.status(400).json({ message: 'Chọn ít nhất một thể loại hợp lệ cho sách.' });
    data.TheLoai = values;
  }
  if (data.AnhBia) {
    const match =
      typeof data.AnhBia === 'string' &&
      data.AnhBia.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) return res.status(400).json({ message: 'Ảnh bìa phải là PNG, JPEG hoặc WebP.' });
    const bytes = Buffer.from(match[2], 'base64');
    const valid =
      match[1] === 'png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : match[1] === 'jpeg'
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!valid || bytes.length > 1024 * 1024)
      return res.status(400).json({ message: 'Ảnh bìa không hợp lệ hoặc vượt quá 1 MB.' });
  }
  if (data.MaNXB && !(await NhaXuatBan.exists({ _id: data.MaNXB })))
    return res.status(400).json({ message: 'Nhà xuất bản không tồn tại.' });
  const b = req.params.id
    ? await Sach.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
    : await Sach.create(data);
  if (!b) return res.status(404).json({ message: 'Không tìm thấy sách.' });
  res.json(b);
}
export async function publishers(req, res) {
  res.json(await NhaXuatBan.find());
}
export async function publisherSave(req, res) {
  const { MaNXB, TenNXB, DiaChi } = req.body;
  res.status(201).json(await NhaXuatBan.create({ MaNXB, TenNXB, DiaChi }));
}
export function chatConfiguration(_req, res) {
  res.set('Cache-Control', 'no-store').json(aiConfiguration());
}

export async function ask(req, res) {
  const question = String(req.body.question || '').trim();
  if (!question || question.length > 1000)
    return res.status(400).json({ message: 'Hãy nhập câu hỏi từ 1 đến 1.000 ký tự.' });
  const books = await Sach.find().populate('MaNXB').lean();
  if (req.body.history !== undefined && !Array.isArray(req.body.history))
    return res.status(400).json({ message: 'Lịch sử hội thoại không hợp lệ.' });
  const reply = await converse(books, question, req.body.history, {
    externalAIConsent: req.body.externalAIConsent === true,
  });
  const ids = reply.bookIds;
  const fresh = await Sach.find({ _id: { $in: ids } })
    .populate('MaNXB')
    .lean();
  const lookup = new Map(fresh.map((b) => [String(b._id), b]));
  const results = ids
    .map((id) => lookup.get(String(id)))
    .filter(Boolean)
    .map((book) => ({
      bookId: book._id,
      book,
      reason: `Chủ đề: ${genresOf(book.TheLoai).join(' · ')}. ${book.MoTa || 'Thư viện chưa bổ sung mô tả nội dung.'}`,
      available: book.SoQuyen > 0,
    }));
  res.json({
    mode: reply.mode,
    answer: reply.answer,
    external: reply.external,
    aiUnavailable: Boolean(reply.aiUnavailable),
    aiError: reply.aiError,
    consentRequired: Boolean(reply.consentRequired),
    stockCheckedAt: new Date().toISOString(),
    results,
  });
}
export async function recommendations(req, res) {
  const history = await TheoDoiMuonSach.find({
    MaDocGia: req.user.id,
    TrangThai: { $in: ['DangMuon', 'DaTra'] },
  }).populate('MaSach');
  const categories = new Set(history.flatMap((h) => genresOf(h.MaSach?.TheLoai)));
  const seen = new Set(history.map((h) => String(h.MaSach?._id)));
  const books = await Sach.find().populate('MaNXB').lean();
  res.json({
    personalized: history.length > 0,
    books: books
      .filter((b) => !seen.has(String(b._id)))
      .sort(
        (a, b) =>
          Number(genresOf(b.TheLoai).some((g) => categories.has(g))) -
            Number(genresOf(a.TheLoai).some((g) => categories.has(g))) || b.LuotMuon - a.LuotMuon,
      )
      .slice(0, 5),
  });
}
