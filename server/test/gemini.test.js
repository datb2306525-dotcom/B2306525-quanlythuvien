import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiConfiguration } from '../src/services/gemini.js';
import { converse } from '../src/services/athena.js';

const books = [
  {
    _id: 'python',
    TenSach: 'Python',
    NguonGocTacGia: 'Test Author',
    MoTa: 'Python cơ bản',
    TheLoai: ['Công nghệ'],
    SoQuyen: 2,
  },
];

async function withGemini(mock, run) {
  const keys = ['AI_PROVIDER', 'GEMINI_API_KEY', 'GEMINI_MODEL'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const fetchBefore = globalThis.fetch;
  process.env.AI_PROVIDER = 'gemini';
  process.env.GEMINI_API_KEY = 'test-only-not-a-real-key';
  delete process.env.GEMINI_MODEL;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), ...options });
    return mock(url, options);
  };
  try {
    await run(requests);
  } finally {
    globalThis.fetch = fetchBefore;
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

const modelResponse = (content, finishReason = 'STOP') => ({
  ok: true,
  json: async () => ({
    candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(content) }] } }],
  }),
});
const valid = {
  answer: 'Bạn có thể bắt đầu với cuốn Python cơ bản này. Bạn đã từng lập trình chưa?',
  bookIds: ['python'],
  outside: [],
};

test('Gemini configuration exposes no secret', async () => {
  await withGemini(
    () => {},
    async () => {
      const config = aiConfiguration();
      assert.deepEqual(config, { provider: 'gemini', configured: true, requiresConsent: true });
      assert.ok(!JSON.stringify(config).includes(process.env.GEMINI_API_KEY));
    },
  );
});

test('Gemini never receives question or history without exact boolean consent', async () => {
  await withGemini(
    () => modelResponse(valid),
    async (requests) => {
      for (const consent of [undefined, false, 'true', 1]) {
        const reply = await converse(
          books,
          'Tôi muốn học Python',
          [{ role: 'user', text: 'Riêng tư' }],
          { externalAIConsent: consent },
        );
        assert.equal(reply.consentRequired, true);
        assert.equal(reply.mode, 'catalog-chat');
      }
      assert.equal(requests.length, 0);
    },
  );
});

test('Gemini uses official endpoint, server-only header and mapped conversation roles', async () => {
  await withGemini(
    () => modelResponse(valid),
    async (requests) => {
      const reply = await converse(
        books,
        'Tôi muốn học Python',
        [
          { role: 'user', text: 'Tôi mới bắt đầu' },
          { role: 'assistant', text: 'Bạn thích học qua thực hành chứ?' },
        ],
        { externalAIConsent: true },
      );
      assert.equal(reply.mode, 'gemini');
      assert.deepEqual(reply.bookIds, ['python']);
      assert.equal(requests.length, 1);
      const request = requests[0];
      assert.equal(
        request.url,
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      );
      assert.equal(request.headers['x-goog-api-key'], 'test-only-not-a-real-key');
      assert.ok(!request.url.includes('test-only'));
      assert.equal(request.redirect, 'error');
      const body = JSON.parse(request.body);
      assert.deepEqual(
        body.contents.map((m) => m.role),
        ['user', 'model', 'user'],
      );
      assert.equal(body.generationConfig.responseMimeType, 'application/json');
      assert.equal(body.generationConfig.thinkingConfig.thinkingBudget, 0);
      assert.ok(!request.body.includes('SoQuyen'));
    },
  );
});

test('Gemini rejects invented IDs using the same catalog validation as Ollama', async () => {
  await withGemini(
    () => modelResponse({ ...valid, bookIds: ['invented'] }),
    async () => {
      const reply = await converse(books, 'Python', [], { externalAIConsent: true });
      assert.equal(reply.aiUnavailable, true);
      assert.deepEqual(reply.bookIds, ['python']);
    },
  );
});

test('Gemini quota and credential errors fall back with safe status, no provider errors', async () => {
  for (const [status, reason] of [
    [429, 'quota'],
    [403, 'configuration'],
    [404, 'configuration'],
    [503, 'unavailable'],
  ]) {
    await withGemini(
      () => ({
        ok: false,
        status,
        json: async () => {
          throw new Error('must not expose response');
        },
      }),
      async (requests) => {
        const reply = await converse(books, 'Python', [], { externalAIConsent: true });
        assert.equal(reply.aiError, reason);
        assert.equal(reply.aiUnavailable, true);
        assert.equal(requests.length, 1); // No automatic retries consuming free-tier quota.
        assert.ok(!JSON.stringify(reply).includes('test-only'));
      },
    );
  }
});

test('missing key and invalid model do not make any external request', async () => {
  await withGemini(
    () => modelResponse(valid),
    async (requests) => {
      delete process.env.GEMINI_API_KEY;
      assert.equal(
        (await converse(books, 'Python', [], { externalAIConsent: true })).aiError,
        'configuration',
      );
      process.env.GEMINI_API_KEY = 'test-only';
      process.env.GEMINI_MODEL = '../bad?key=secret';
      assert.equal(
        (await converse(books, 'Python', [], { externalAIConsent: true })).aiError,
        'configuration',
      );
      assert.equal(requests.length, 0);
    },
  );
});

test('blocked, truncated, malformed and failed Gemini responses fall back safely', async () => {
  const mocks = [
    () => modelResponse(valid, 'MAX_TOKENS'),
    () => ({ ok: true, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) }),
    () => ({
      ok: true,
      json: async () => ({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{invalid' }] } }],
      }),
    }),
    () => {
      throw new Error('network timeout');
    },
  ];
  for (const mock of mocks)
    await withGemini(mock, async () => {
      const reply = await converse(books, 'Python', [], { externalAIConsent: true });
      assert.equal(reply.aiUnavailable, true);
      assert.deepEqual(reply.bookIds, ['python']);
    });
});

test('borrowing guide works without spending Gemini requests even with consent', async () => {
  await withGemini(
    () => modelResponse(valid),
    async (requests) => {
      const reply = await converse(books, 'Hướng dẫn mượn sách', [], { externalAIConsent: true });
      assert.equal(reply.mode, 'library-guide');
      assert.equal(requests.length, 0);
    },
  );
});
