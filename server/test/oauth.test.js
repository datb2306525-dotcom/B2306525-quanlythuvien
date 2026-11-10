import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';

test(
  'OAuth: browser binding, one-use codes, profile completion, account isolation and locks',
  { skip: process.env.RUN_DB_TEST !== '1', timeout: 180000 },
  async () => {
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    const mongoose = (await import('mongoose')).default;
    const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    let server;
    try {
      process.env.JWT_SECRET = 'oauth-test-only-secret-longer-than-32-characters';
      process.env.MONGODB_URI = mongo.getUri('oauth_test');
      process.env.PORT = '0';
      process.env.NODE_ENV = 'test';
      ({ server } = await import('../src/app.js'));
      if (!server.listening) await new Promise((resolve) => server.once('listening', resolve));
      const origin = 'http://127.0.0.1:' + server.address().port;
      process.env.CLIENT_ORIGIN = origin;
      process.env.OAUTH_PUBLIC_ORIGIN = origin;
      const nativeFetch = globalThis.fetch;
      const request = (path, body, cookies = '', extra = {}) =>
        nativeFetch(origin + '/api/auth/oauth' + path, {
          method: body ? 'POST' : 'GET',
          redirect: 'manual',
          headers: {
            'Content-Type': 'application/json',
            Origin: origin,
            Cookie: cookies,
            ...extra,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      assert.equal((await request('/google/start')).status, 503);
      process.env.GOOGLE_CLIENT_ID = 'test-google-client';
      process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
      process.env.FACEBOOK_CLIENT_ID = 'test-facebook-client';
      process.env.FACEBOOK_CLIENT_SECRET = 'test-facebook-secret';
      process.env.FACEBOOK_GRAPH_VERSION = 'v25.0';
      assert.deepEqual(await (await request('/providers')).json(), {
        google: true,
        facebook: false,
      });
      const { OAuthTicket, DocGia } = await import('../src/models/index.js');
      const { OAuth2Client } = await import('google-auth-library');
      const hash = (value) => createHash('sha256').update(value).digest('hex');
      let googlePayload;
      let tokenFailure = false;
      mock.method(OAuth2Client.prototype, 'verifyIdToken', async (options) => {
        assert.equal(options.audience, 'test-google-client');
        return { getPayload: () => googlePayload };
      });
      mock.method(globalThis, 'fetch', async (url, options) => {
        const address = String(url);
        if (address === 'https://oauth2.googleapis.com/token') {
          assert.ok(options.body.get('code_verifier'));
          if (tokenFailure)
            return Response.json(
              { error: 'invalid_client', error_description: 'DO_NOT_EXPOSE_PROVIDER_DETAIL' },
              { status: 401 },
            );
          return Response.json({ id_token: 'mock-id-token' });
        }
        if (address.includes('/oauth/access_token'))
          return Response.json({ access_token: 'mock-facebook-token' });
        if (address.includes('/debug_token'))
          return Response.json({
            data: { is_valid: true, app_id: 'test-facebook-client', user_id: 'fb-reader' },
          });
        if (address.includes('/me?'))
          return Response.json({
            id: 'fb-reader',
            name: 'Facebook Reader',
            email: 'facebook@test.vn',
          });
        return nativeFetch(url, options);
      });
      async function begin(provider = 'google', email = 'google@test.vn') {
        const start = await request('/' + provider + '/start');
        assert.equal(start.status, 302);
        const authorize = new URL(start.headers.get('location'));
        const cookie = start.headers.getSetCookie()[0].split(';')[0];
        const state = authorize.searchParams.get('state');
        const record = await OAuthTicket.findById(hash(state));
        googlePayload = {
          sub: 'google-reader',
          email,
          name: 'Google Reader',
          email_verified: true,
          nonce: record.data.nonce,
        };
        return { cookie, state, provider };
      }
      async function callback(attempt, cookie = attempt.cookie) {
        const response = await request(
          '/' + attempt.provider + '/callback?code=mock-code&state=' + attempt.state,
          undefined,
          cookie,
        );
        assert.equal(response.status, 302);
        return new URLSearchParams(new URL(response.headers.get('location')).hash.slice(1));
      }
      const rejected = await begin();
      tokenFailure = true;
      const rejectedMessage = (await callback(rejected)).get('oauth_error');
      assert.match(rejectedMessage, /Client ID/);
      assert.ok(!rejectedMessage.includes('DO_NOT_EXPOSE_PROVIDER_DETAIL'));
      tokenFailure = false;
      const attempt = await begin();
      assert.ok((await callback(attempt, '')).has('oauth_error'));
      const params = await callback(attempt);
      const code = params.get('oauth_code');
      assert.ok(code);
      assert.ok((await callback(attempt)).has('oauth_error'));
      assert.equal((await request('/exchange', { code }, '')).status, 400);
      assert.equal(
        (await request('/exchange', { code }, attempt.cookie, { Origin: 'https://evil.example' }))
          .status,
        400,
      );
      const exchanged = await request('/exchange', { code }, attempt.cookie);
      assert.equal(exchanged.status, 200);
      assert.equal((await exchanged.json()).profileRequired, true);
      assert.equal((await request('/exchange', { code }, attempt.cookie)).status, 400);
      const signupCookie = exchanged.headers.getSetCookie()[0].split(';')[0];
      const cookies = attempt.cookie + '; ' + signupCookie;
      const profile = {
        HoLot: 'Test',
        Ten: 'Reader',
        NgaySinh: '2002-01-01',
        Phai: 'Khác',
        DiaChi: 'Can Tho',
        DienThoai: '0900000000',
        LoaiDocGia: 'Sinh viên',
        Email: 'attacker@test.vn',
        role: 'Admin',
        Password: 'InjectedPassword',
      };
      assert.equal((await request('/complete', profile, '')).status, 400);
      assert.equal((await request('/complete', { ...profile, NgaySinh: '' }, cookies)).status, 400);
      const created = await request('/complete', profile, cookies);
      assert.equal(created.status, 201);
      const account = await created.json();
      assert.equal(account.user.role, 'Reader');
      assert.equal(account.user.email, 'google@test.vn');
      const socialProfile = await nativeFetch(origin + '/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + account.token },
        body: JSON.stringify({ Ten: 'Updated Google Reader' }),
      });
      assert.equal(socialProfile.status, 200);
      assert.equal((await socialProfile.json()).user.name, 'Test Updated Google Reader');
      assert.equal(await DocGia.countDocuments(), 1);
      assert.equal(
        (await DocGia.findById(account.user.id).select('+Password')).Password,
        undefined,
      );
      assert.equal((await request('/complete', profile, cookies)).status, 400);
      // Repeat login resolves by provider subject, never by client-supplied email.
      const repeat = await begin();
      const repeatCode = (await callback(repeat)).get('oauth_code');
      const loggedIn = await request('/exchange', { code: repeatCode }, repeat.cookie);
      assert.equal((await loggedIn.json()).user.id, account.user.id);
      await DocGia.findByIdAndUpdate(account.user.id, { BiKhoa: true });
      const locked = await begin();
      const lockedCode = (await callback(locked)).get('oauth_code');
      assert.equal((await request('/exchange', { code: lockedCode }, locked.cookie)).status, 403);
      // Disabled Facebook cannot be enabled by leftover environment variables.
      assert.equal((await request('/facebook/start')).status, 503);
      // A different Google identity cannot silently merge into the existing account.
      const collision = await begin();
      googlePayload.sub = 'another-google-reader';
      const collisionCode = (await callback(collision)).get('oauth_code');
      assert.equal(
        (await request('/exchange', { code: collisionCode }, collision.cookie)).status,
        409,
      );
      // Expired tickets are rejected even before MongoDB's TTL worker removes them.
      const expiredKey = randomBytes(32).toString('base64url');
      await OAuthTicket.create({
        _id: hash(expiredKey),
        kind: 'exchange',
        binding: hash(attempt.cookie.split('=')[1]),
        expiresAt: new Date(Date.now() - 1000),
        data: {},
      });
      assert.equal((await request('/exchange', { code: expiredKey }, attempt.cookie)).status, 400);
    } finally {
      mock.restoreAll();
      if (server) await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
      await mongo.stop();
    }
  },
);
