import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genresOf, genreLabel } from '../../shared/genres.js';
import { defaultGenres, readerCategories, filterCatalog } from '../../client/src/genres.js';

test('genre filters treat serialized legacy lists as separate categories', () => {
  const expected = ['Kỹ năng sống', 'Phát triển bản thân', 'Tâm lý'];
  for (const input of [
    expected,
    JSON.stringify(expected),
    [JSON.stringify(expected)],
    [JSON.stringify(JSON.stringify(expected))],
  ]) {
    const genres = genresOf(input);
    assert.deepEqual(genres, expected);
    for (const category of expected) assert.ok(genres.includes(category));
    assert.equal(genreLabel(input), 'Kỹ năng sống · Phát triển bản thân · Tâm lý');
    const quickFilters = [...new Set([...defaultGenres, ...genres])];
    assert.ok(!quickFilters.some((item) => item.startsWith('[')));
    assert.ok(!genres.includes('Văn học'));
  }
  assert.deepEqual(genresOf([' Văn học ', 'Văn học', '["Lịch sử"]']), ['Văn học', 'Lịch sử']);
  assert.deepEqual(genresOf('Công nghệ'), ['Công nghệ']);
  assert.deepEqual(genresOf('[not valid JSON]'), []);
});

test('reader buttons stay fixed and independently find each genre from screenshot data', () => {
  const books = [
    { TenSach: 'Đắc nhân tâm', TheLoai: '["Kỹ năng sống", "Phát triển bản thân", "Tâm lý"]' },
    { TenSach: 'Lược sử', TheLoai: ['["Lịch sử", "Khoa học"]'] },
    { TenSach: 'Khoa học khác', TheLoai: [' khoa học '] },
    { TenSach: 'Truyện', TheLoai: ['Văn học'] },
  ];
  assert.deepEqual(readerCategories, ['Tất cả', ...defaultGenres]);
  assert.ok(!readerCategories.some((label) => label.includes('[')));
  for (const category of ['Kỹ năng sống', 'Phát triển bản thân', 'Tâm lý']) {
    assert.deepEqual(
      filterCatalog(books, category).map((b) => b.TenSach),
      ['Đắc nhân tâm'],
    );
  }
  assert.deepEqual(
    filterCatalog(books, 'Khoa học').map((b) => b.TenSach),
    ['Lược sử', 'Khoa học khác'],
  );
  assert.deepEqual(
    filterCatalog(books, 'Lịch sử').map((b) => b.TenSach),
    ['Lược sử'],
  );
  assert.deepEqual(
    filterCatalog(books, 'Tất cả', 'tam ly').map((b) => b.TenSach),
    ['Đắc nhân tâm'],
  );
  assert.equal(filterCatalog(books).length, 4);
});
