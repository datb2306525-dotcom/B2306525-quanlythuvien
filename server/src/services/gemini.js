// Fixed Google endpoint: API keys and chat data never go to a client-provided URL.
export function aiConfiguration() {
  const provider =
    process.env.AI_PROVIDER?.trim().toLowerCase() ||
    (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OLLAMA_URL ? 'ollama' : 'catalog');
  return {
    provider,
    configured:
      provider === 'gemini'
        ? Boolean(process.env.GEMINI_API_KEY?.trim())
        : provider === 'ollama'
          ? Boolean(process.env.OLLAMA_URL)
          : false,
    requiresConsent: provider === 'gemini',
  };
}

const responseSchema = {
  type: 'OBJECT',
  properties: {
    answer: { type: 'STRING' },
    bookIds: { type: 'ARRAY', items: { type: 'STRING' } },
    outside: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          author: { type: 'STRING' },
          reason: { type: 'STRING' },
        },
        required: ['title', 'author', 'reason'],
      },
    },
  },
  required: ['answer', 'bookIds', 'outside'],
};

export async function generateGemini(messages) {
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) return { ok: false, reason: 'configuration' };
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return { ok: false, reason: 'configuration' };
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(25000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: messages[0].content }] },
          contents: messages.slice(1).map((message) => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.content }],
          })),
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
            responseSchema,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        reason:
          response.status === 429
            ? 'quota'
            : [401, 403, 404, 400].includes(response.status)
              ? 'configuration'
              : 'unavailable',
      };
    }
    const data = await response.json();
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') return { ok: false, reason: 'unavailable' };
    const text = candidate.content?.parts
      ?.filter((part) => !part.thought && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
    if (!text) return { ok: false, reason: 'unavailable' };
    return { ok: true, text };
  } catch {
    // Never log raw provider errors, keys or personal messages.
    return { ok: false, reason: 'unavailable' };
  }
}
