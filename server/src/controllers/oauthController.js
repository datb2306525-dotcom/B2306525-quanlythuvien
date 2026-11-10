import { randomBytes, createHash, createHmac } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { DocGia, OAuthTicket } from '../models/index.js';
import { session } from './authController.js';

const random = () => randomBytes(32).toString('base64url');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message) => Object.assign(new Error(message), { status: 400 });
const duration = 10 * 60 * 1000;
function settings(provider) {
  if (!['google', 'facebook'].includes(provider)) throw fail('Nhà cung cấp không hợp lệ.');
  const prefix = provider.toUpperCase();
  const origin = process.env.OAUTH_PUBLIC_ORIGIN || '';
  const clientOrigin = process.env.CLIENT_ORIGIN || origin;
  let api, client;
  try {
    api = new URL(origin);
    client = new URL(clientOrigin);
  } catch {
    return null;
  }
  if (
    ![api, client].every(
      (url) =>
        url.protocol === 'https:' ||
        (process.env.NODE_ENV !== 'production' &&
          url.protocol === 'http:' &&
          ['localhost', '127.0.0.1'].includes(url.hostname)),
    )
  )
    return null;
  // The browser cookie exchange requires same-origin hosting in production.
  if (process.env.NODE_ENV === 'production' && api.origin !== client.origin) return null;
  const id = process.env[prefix + '_CLIENT_ID'];
  const secret = process.env[prefix + '_CLIENT_SECRET'];
  const version = process.env.FACEBOOK_GRAPH_VERSION;
  if (!id || !secret || (provider === 'facebook' && !/^v\d+\.\d+$/.test(version || '')))
    return null;
  return {
    id,
    secret,
    version,
    origin: api.origin,
    clientOrigin: client.origin,
    redirect: api.origin + '/api/auth/oauth/' + provider + '/callback',
  };
}
function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/oauth',
    maxAge: duration,
  };
}
function clearCookie(res, name) {
  const { maxAge, ...options } = cookieOptions();
  res.clearCookie(name, options);
}
function cookie(req, name) {
  const value = req.headers.cookie
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith(name + '='))
    ?.slice(name.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
}
function sameOrigin(req) {
  const allowed = process.env.CLIENT_ORIGIN || process.env.OAUTH_PUBLIC_ORIGIN;
  if (!allowed || req.headers.origin !== new URL(allowed).origin)
    throw fail('Yêu cầu đăng nhập không hợp lệ.');
}
async function ticket(kind, data, binding) {
  const key = random();
  await OAuthTicket.create({
    _id: hash(key),
    kind,
    data,
    binding,
    expiresAt: new Date(Date.now() + duration),
  });
  return key;
}
async function json(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  const data = await response.json();
  if (!response.ok || data.error) throw fail('Không xác minh được tài khoản. Vui lòng thử lại.');
  return data;
}
export function providers(_req, res) {
  res.json({ google: Boolean(settings('google')), facebook: Boolean(settings('facebook')) });
}
export async function start(req, res) {
  const { provider } = req.params;
  const config = settings(provider);
  if (!config)
    return res.status(503).json({ message: 'Đăng nhập bằng dịch vụ này chưa được cấu hình.' });
  const browser = random(),
    verifier = random(),
    nonce = random();
  const state = await ticket('state', { provider, verifier, nonce }, hash(browser));
  res.cookie('athena-oauth', browser, cookieOptions());
  const url = new URL(
    provider === 'google'
      ? 'https://accounts.google.com/o/oauth2/v2/auth'
      : `https://www.facebook.com/${config.version}/dialog/oauth`,
  );
  const params = {
    client_id: config.id,
    redirect_uri: config.redirect,
    response_type: 'code',
    state,
    scope: provider === 'google' ? 'openid email profile' : 'public_profile,email',
  };
  if (provider === 'google')
    Object.assign(params, {
      nonce,
      prompt: 'select_account',
      code_challenge_method: 'S256',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    });
  url.search = new URLSearchParams(params).toString();
  res.set('Cache-Control', 'no-store').redirect(url.href);
}
export async function callback(req, res) {
  const { provider } = req.params;
  const config = settings(provider);
  if (!config) return res.status(503).json({ message: 'Đăng nhập chưa được cấu hình.' });
  const target = new URL('/auth/callback', config.clientOrigin);
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
  try {
    const browser = cookie(req, 'athena-oauth');
    if (!browser || typeof req.query.state !== 'string')
      throw fail('Phiên xác thực đã hết hạn. Vui lòng đăng nhập lại.');
    const state = await OAuthTicket.findOneAndDelete({
      _id: hash(req.query.state),
      kind: 'state',
      binding: hash(browser),
      expiresAt: { $gt: new Date() },
    });
    if (!state || state.data.provider !== provider)
      throw fail('Phiên xác thực không hợp lệ hoặc đã sử dụng.');
    if (req.query.error) throw fail('Bạn đã hủy hoặc từ chối đăng nhập.');
    if (typeof req.query.code !== 'string') throw fail('Thiếu mã xác thực.');
    let identity;
    if (provider === 'google') {
      const tokens = await json('https://oauth2.googleapis.com/token', {
        method: 'POST',
        body: new URLSearchParams({
          code: req.query.code,
          client_id: config.id,
          client_secret: config.secret,
          redirect_uri: config.redirect,
          grant_type: 'authorization_code',
          code_verifier: state.data.verifier,
        }),
      });
      const verified = await new OAuth2Client(config.id).verifyIdToken({
        idToken: tokens.id_token,
        audience: config.id,
      });
      const profile = verified.getPayload();
      if (!profile?.sub || !profile.email_verified || profile.nonce !== state.data.nonce)
        throw fail('Google chưa xác minh được tài khoản hoặc email.');
      identity = { provider, subject: profile.sub, email: profile.email, name: profile.name };
    } else {
      const base = `https://graph.facebook.com/${config.version}`;
      const tokenUrl = new URL(base + '/oauth/access_token');
      tokenUrl.search = new URLSearchParams({
        client_id: config.id,
        client_secret: config.secret,
        redirect_uri: config.redirect,
        code: req.query.code,
      }).toString();
      const tokens = await json(tokenUrl);
      if (!tokens.access_token) throw fail('Thiếu mã xác thực Facebook.');
      const debugUrl = new URL(base + '/debug_token');
      debugUrl.searchParams.set('input_token', tokens.access_token);
      const debug = await json(debugUrl, {
        headers: { Authorization: 'Bearer ' + config.id + '|' + config.secret },
      });
      if (!debug.data?.is_valid || String(debug.data.app_id) !== config.id || !debug.data.user_id)
        throw fail('Phiên Facebook không hợp lệ.');
      const profileUrl = new URL(base + '/me');
      profileUrl.search = new URLSearchParams({
        fields: 'id,name,email',
        appsecret_proof: createHmac('sha256', config.secret)
          .update(tokens.access_token)
          .digest('hex'),
      }).toString();
      const profile = await json(profileUrl, {
        headers: { Authorization: 'Bearer ' + tokens.access_token },
      });
      if (profile.id !== debug.data.user_id) throw fail('Không xác minh được tài khoản Facebook.');
      identity = { provider, subject: profile.id, email: profile.email, name: profile.name };
    }
    if (!/^\S+@\S+\.\S+$/.test(identity.email || ''))
      throw fail(
        'Dịch vụ chưa cung cấp email. Hãy cho phép chia sẻ email hoặc dùng cách đăng nhập khác.',
      );
    identity.email = identity.email.toLowerCase().trim();
    const code = await ticket('exchange', identity, hash(browser));
    target.hash = new URLSearchParams({ oauth_code: code }).toString();
  } catch (error) {
    // Provider responses and credentials must never be exposed in the URL or server logs.
    target.hash = new URLSearchParams({
      oauth_error: error.status === 400 ? error.message : 'Xác thực thất bại. Vui lòng thử lại.',
    }).toString();
  }
  res.redirect(target.href);
}
export async function exchange(req, res) {
  sameOrigin(req);
  res.set('Cache-Control', 'no-store');
  const browser = cookie(req, 'athena-oauth');
  if (!browser || typeof req.body.code !== 'string') throw fail('Phiên đăng nhập không hợp lệ.');
  const record = await OAuthTicket.findOneAndDelete({
    _id: hash(req.body.code),
    kind: 'exchange',
    binding: hash(browser),
    expiresAt: { $gt: new Date() },
  });
  if (!record) throw fail('Phiên đăng nhập đã hết hạn hoặc đã sử dụng.');
  const identity = record.data;
  const field = identity.provider === 'google' ? 'GoogleId' : 'FacebookId';
  const reader = await DocGia.findOne({ [field]: identity.subject });
  if (reader) {
    if (reader.BiKhoa)
      return res.status(403).json({ message: 'Tài khoản đã bị khóa. ' + reader.LyDoKhoa });
    clearCookie(res, 'athena-oauth');
    return res.json(session(reader, 'Reader'));
  }
  if (await DocGia.exists({ Email: identity.email }))
    return res
      .status(409)
      .json({
        message:
          'Email đã có tài khoản độc giả. Vui lòng dùng phương thức đăng nhập ban đầu; không tự ghép tài khoản.',
      });
  const signup = await ticket('signup', identity, hash(browser));
  res.cookie('athena-social-signup', signup, cookieOptions());
  res.json({
    profileRequired: true,
    profile: { name: identity.name || '', email: identity.email },
  });
}
export async function complete(req, res) {
  sameOrigin(req);
  res.set('Cache-Control', 'no-store');
  const key = cookie(req, 'athena-social-signup'),
    browser = cookie(req, 'athena-oauth');
  if (!key || !browser)
    throw fail('Phiên đăng ký đã hết hạn. Hãy đăng nhập lại bằng Google/Facebook.');
  const record = await OAuthTicket.findOne({
    _id: hash(key),
    kind: 'signup',
    binding: hash(browser),
    expiresAt: { $gt: new Date() },
  });
  if (!record) throw fail('Phiên đăng ký đã hết hạn hoặc đã sử dụng.');
  const identity = record.data;
  const { HoLot, Ten, NgaySinh, Phai, DiaChi, DienThoai, LoaiDocGia } = req.body;
  const birth = new Date(NgaySinh);
  if (!NgaySinh || Number.isNaN(birth.getTime()) || birth > new Date())
    throw fail('Ngày sinh không hợp lệ.');
  const field = identity.provider === 'google' ? 'GoogleId' : 'FacebookId';
  if (await DocGia.exists({ $or: [{ Email: identity.email }, { [field]: identity.subject }] }))
    return res.status(409).json({ message: 'Tài khoản đã tồn tại. Vui lòng đăng nhập lại.' });
  const reader = await DocGia.create({
    MaDocGia: 'DG' + randomBytes(8).toString('hex'),
    Email: identity.email,
    [field]: identity.subject,
    HoLot,
    Ten,
    NgaySinh,
    Phai,
    DiaChi,
    DienThoai,
    LoaiDocGia,
  });
  await OAuthTicket.deleteOne({ _id: record._id });
  clearCookie(res, 'athena-social-signup');
  clearCookie(res, 'athena-oauth');
  res.status(201).json(session(reader, 'Reader'));
}
