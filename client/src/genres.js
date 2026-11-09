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
export const genresOf = (value) =>
  Array.isArray(value) ? value : typeof value === 'string' && value.trim() ? [value.trim()] : [];
export const genreLabel = (value) => genresOf(value).join(' · ');
