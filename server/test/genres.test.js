import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genresOf, genreLabel } from '../../shared/genres.js';
import { defaultGenres } from '../../client/src/genres.js';

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
