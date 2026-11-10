import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { auth } from '../middleware/auth.js';
import * as oauth from '../controllers/oauthController.js';
import * as accounts from '../controllers/authController.js';
import * as books from '../controllers/bookController.js';
import * as loans from '../controllers/loanController.js';
import * as reports from '../controllers/reportController.js';
const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const staff = auth(['Admin', 'Librarian']);
const limit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
});
router.get('/auth/oauth/providers', oauth.providers);
router.get('/auth/oauth/:provider/start', limit, wrap(oauth.start));
router.get('/auth/oauth/:provider/callback', limit, wrap(oauth.callback));
router.post('/auth/oauth/exchange', limit, wrap(oauth.exchange));
router.post('/auth/oauth/complete', limit, wrap(oauth.complete));
router.post('/auth/register', limit, wrap(accounts.register));
router.post('/auth/login', limit, wrap(accounts.login));
router.get('/books', wrap(books.list));
router.get('/books/:id', wrap(books.detail));
router.post('/books', staff, wrap(books.save));
router.put('/books/:id', staff, wrap(books.save));
router.get('/publishers', wrap(books.publishers));
router.post('/publishers', staff, wrap(books.publisherSave));
router.post('/ai/search', limit, wrap(books.ask));
router.get('/recommendations', auth(['Reader']), wrap(books.recommendations));
router.get('/loans', auth(), wrap(loans.list));
router.post('/loans', auth(['Reader']), wrap(loans.request));
router.patch('/loans/:id', auth(), wrap(loans.action));
router.get('/admin/stats', staff, wrap(loans.overview));
router.get('/admin/readers', staff, wrap(loans.readers));
router.patch('/admin/readers/:id/lock', staff, wrap(accounts.lockReader));
router.get('/auth/profile', auth(['Reader']), wrap(accounts.profile));
router.patch('/auth/profile', auth(['Reader']), wrap(accounts.updateProfile));
router.get('/auth/me', auth(), (req, res) =>
  res.json({
    id: req.user.id,
    role: req.user.role,
    name:
      req.user.role === 'Reader'
        ? `${req.user.profile.HoLot} ${req.user.profile.Ten}`
        : req.user.profile.HoTenNV,
  }),
);
router.get('/reports', auth(), wrap(reports.list));
router.post('/reports', auth(['Reader']), limit, wrap(reports.create));
router.patch('/reports/:id', staff, wrap(reports.update));
export default router;
