// Accept legacy single genres and JSON accidentally saved as a string or array item.
export function genresOf(value) {
  function read(entry, depth = 0) {
    if (depth > 5) return [];
    if (Array.isArray(entry)) return entry.flatMap((item) => read(item, depth + 1));
    if (typeof entry !== 'string') return [];
    const text = entry.trim();
    if (!text) return [];
    if (text.startsWith('[') || text.startsWith('"') || text.startsWith('{')) {
      try {
        return read(JSON.parse(text), depth + 1);
      } catch {
        return [];
      }
    }
    return [text];
  }
  return [...new Set(read(value))];
}
export const genreLabel = (value) => genresOf(value).join(' · ');
