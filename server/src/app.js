import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import routes from './routes/index.js';
import { initializeModels } from './initializeModels.js';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw new Error('Cần JWT_SECRET có ít nhất 32 ký tự trong server/.env.');
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/QuanLyMuonSach', {
  autoIndex: false,
});
await initializeModels();
const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use('/api/books', express.json({ limit: '2mb' }));
app.use(express.json({ limit: '32kb' }));
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', database: mongoose.connection.readyState === 1 }),
);
app.use('/api', routes);
app.use('/api', (_req, res) => res.status(404).json({ message: 'API không tồn tại.' }));
const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status =
    err.code === 11000
      ? 409
      : ['ValidationError', 'CastError'].includes(err.name)
        ? 400
        : err.status || 500;
  res.status(status).json({
    message:
      err.code === 11000
        ? 'Dữ liệu đã tồn tại hoặc bạn đang có yêu cầu mượn cuốn sách này.'
        : status === 500
          ? 'Không thể xử lý yêu cầu. Vui lòng kiểm tra máy chủ.'
          : err.message,
  });
  if (status === 500) console.error(err);
});
export const server = app.listen(process.env.PORT || 3000, () =>
  console.log('Library API listening on port ' + server.address().port),
);
