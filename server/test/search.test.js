import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankBooks, fineFor } from '../src/services/search.js';
const books = [
  {
    _id: 'real-python',
    TenSach: 'Python cơ bản',
    TheLoai: 'Công nghệ',
    MoTa: 'Dành cho người mới bắt đầu',
    NguonGocTacGia: 'Eric Matthes',
  },
  {
    _id: 'real-business',
    TenSach: 'Quản trị kinh doanh',
    TheLoai: 'Kinh tế',
    MoTa: 'Business management',
    NguonGocTacGia: 'Peter Drucker',
  },
];
test('natural-language search returns existing catalog IDs', () => {
  const results = rankBooks(books, 'Tôi muốn học Python từ con số 0');
  assert.equal(results[0].book._id, 'real-python');
  assert.ok(results.every((r) => books.includes(r.book)));
});
test('unmatched query never invents a book', () =>
  assert.deepEqual(rankBooks(books, 'thiên văn lượng tử'), []));
test('fine is zero before due date, charges each started overdue day', () => {
  assert.equal(fineFor('2026-11-05', '2026-11-04'), 0);
  assert.equal(fineFor('2026-11-05', '2026-11-06T00:00:01Z'), 10000);
  assert.equal(fineFor(null), 0);
});
