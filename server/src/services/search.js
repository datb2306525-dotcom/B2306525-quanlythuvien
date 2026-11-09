export const normalize = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
const stop = new Set(
  'toi muon hoc tu con so co sach nao ve phu hop sinh vien nam khong tim can voi vi du goi y cuon danh cho nguoi moi mot nhung cac la va cua duoc hay giup ban cho minh'.split(
    ' ',
  ),
);
export function rankBooks(books, query) {
  const q = normalize(query);
  let terms = q.split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !stop.has(t));
  const aliases = [
    [/tri tue nhan tao|\bai\b/, 'artificial intelligence machine learning'],
    [/bao mat|an ninh/, 'security cybersecurity'],
    [/quan tri kinh doanh/, 'business management'],
    [/lap trinh/, 'programming'],
    [/con so 0|nguoi moi|co ban/, 'nhap mon co ban beginner'],
  ];
  for (const [re, extra] of aliases) if (re.test(q)) terms.push(...extra.split(' '));
  terms = [...new Set(terms)];
  return books
    .map((book) => {
      const title = normalize(book.TenSach),
        category = normalize(book.TheLoai),
        body = normalize(book.MoTa + ' ' + book.NguonGocTacGia);
      const score = terms.reduce(
        (n, t) =>
          n +
          (title.includes(t) ? 5 : 0) +
          (category.includes(t) ? 3 : 0) +
          (body.includes(t) ? 1 : 0),
        0,
      );
      return { book, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
export function fineFor(due, now = new Date(), rate = 5000) {
  return due ? Math.max(0, Math.ceil((new Date(now) - new Date(due)) / 86400000)) * rate : 0;
}
