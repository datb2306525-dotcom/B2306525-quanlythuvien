import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { geminiFailure, geminiModel, generateGemini } from './services/gemini.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const key = process.env.GEMINI_API_KEY?.trim();
const model = geminiModel();
if (!key || !model) {
  console.log(JSON.stringify({ ok: false, reason: !key ? 'missing_key' : 'invalid_model_name' }));
  process.exitCode = 1;
} else {
  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
      {
        headers: { 'x-goog-api-key': key },
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
      },
    );
    const payload = await response.json();
    if (!response.ok) {
      console.log(JSON.stringify(geminiFailure(response.status, payload)));
      process.exitCode = 1;
    } else {
      const names = (payload.models || [])
        .filter((item) => item.supportedGenerationMethods?.includes('generateContent'))
        .map((item) => item.name?.replace(/^models\//, ''))
        .filter((name) => typeof name === 'string' && /^gemini-[a-zA-Z0-9._-]+$/.test(name));
      const available = names.includes(model);
      console.log(
        JSON.stringify({
          step: 'model_access',
          model,
          available,
          candidates: names
            .filter((name) => /flash/.test(name) && !/image|audio|tts|live/.test(name))
            .slice(0, 12),
        }),
      );
      if (!available) {
        process.exitCode = 1;
      } else if (process.argv.includes('--generate')) {
        // Optional small diagnostic request; no real conversation or account data is sent.
        const reply = await generateGemini([
          {
            role: 'system',
            content: 'Return JSON {"answer":"Xin chào","bookIds":[],"outside":[]}.',
          },
          { role: 'user', content: 'Xin chào.' },
        ]);
        console.log(
          JSON.stringify({
            step: 'generation',
            ok: reply.ok,
            reason: reply.reason,
            httpStatus: reply.httpStatus,
            detail: reply.detail,
          }),
        );
        if (!reply.ok) process.exitCode = 1;
      }
    }
  } catch {
    console.log(JSON.stringify({ ok: false, reason: 'network_or_timeout' }));
    process.exitCode = 1;
  }
}
