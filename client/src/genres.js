import { genreLabel, genreKey, matchesGenre } from '../../shared/genres.js';
export const defaultGenres = [
  'Lịch sử',
  'Văn học',
  'Kinh tế',
  'Công nghệ',
  'Nghệ thuật',
  'Khoa học',
  'Phát triển bản thân',
  'Tâm lý',
  'Kỹ năng sống',
];
export { genresOf, genreLabel, matchesGenre } from '../../shared/genres.js';

export const readerCategories = ['Tất cả', ...defaultGenres];
export function filterCatalog(books, category = 'Tất cả', query = '') {
  const keyword = genreKey(query);
  return books.filter(
    (book) =>
      (category === 'Tất cả' || matchesGenre(book.TheLoai, category)) &&
      genreKey([book.TenSach, book.NguonGocTacGia, genreLabel(book.TheLoai)].join(' ')).includes(
        keyword,
      ),
  );
}
