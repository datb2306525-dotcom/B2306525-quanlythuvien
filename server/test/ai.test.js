import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchCatalog } from '../src/services/ai.js';
test('AI rejects invented book IDs and falls back to verified catalog', async () => {
  const previous = globalThis.fetch;
  const url = process.env.OLLAMA_URL;
  process.env.OLLAMA_URL = 'http://test.local';
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ message: { content: JSON.stringify({ bookIds: ['invented-id'] }) } }),
  });
  try {
    const result = await searchCatalog(
      [{ _id: 'real-id', TenSach: 'Python', TheLoai: 'Công nghệ', MoTa: 'Python cơ bản' }],
      'học Python',
    );
    assert.equal(result.mode, 'catalog-search');
    assert.equal(result.matches[0].book._id, 'real-id');
  } finally {
    globalThis.fetch = previous;
    if (url === undefined) delete process.env.OLLAMA_URL;
    else process.env.OLLAMA_URL = url;
  }
});
