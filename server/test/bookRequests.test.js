import { test } from 'node:test';
import assert from 'node:assert/strict';

test(
  'MongoDB: book requests isolate readers, reject duplicates and track staff fulfillment',
  { skip: process.env.RUN_DB_TEST !== '1', timeout: 180000 },
  async () => {
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    const mongoose = (await import('mongoose')).default;
    const bcrypt = (await import('bcryptjs')).default;
    const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    let server;
    try {
      process.env.MONGODB_URI = mongo.getUri('requests_test');
      process.env.JWT_SECRET = 'book-request-test-secret-longer-than-32-characters';
      process.env.PORT = '0';
      ({ server } = await import('../src/app.js'));
      if (!server.listening) await new Promise((resolve) => server.once('listening', resolve));
      const base = 'http://127.0.0.1:' + server.address().port + '/api';
      const request = async (path, method = 'GET', body, token) => {
        const response = await fetch(base + path, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        return { status: response.status, data: await response.json() };
      };
      const { NhanVien, DocGia, Sach, NhaXuatBan, YeuCauBoSungSach } =
        await import('../src/models/index.js');
      await NhanVien.create({
        MSNV: 'NVT',
        HoTenNV: 'Test Librarian',
        Password: await bcrypt.hash('Librarian123', 4),
        Email: 'staff@request.test',
        ChucVu: 'Librarian',
        DiaChi: 'Test',
        SoDienThoai: '0900000000',
      });
      const signup = async (number) =>
        (
          await request('/auth/register', 'POST', {
            HoLot: 'Test',
            Ten: 'Reader' + number,
            Email: `reader${number}@request.test`,
            Password: 'Reader123',
            NgaySinh: '2003-01-01',
            Phai: 'Nam',
            DiaChi: 'Test',
            DienThoai: '0900000000',
          })
        ).data;
      const a = await signup(1),
        b = await signup(2);
      const staff = (
        await request('/auth/login', 'POST', {
          email: 'staff@request.test',
          password: 'Librarian123',
          portal: 'admin',
        })
      ).data.token;
      assert.ok(staff);
      assert.equal((await request('/book-requests')).status, 401);
      assert.equal(
        (await request('/book-requests', 'POST', { title: 'Test', reason: 'Test' }, staff)).status,
        403,
      );
      for (const invalid of [
        { title: '', reason: 'Test' },
        { title: 'Test', reason: ' ' },
        { title: {}, reason: 'Test' },
        { title: 'x'.repeat(201), reason: 'Test' },
        { title: 'Test', author: [], reason: 'Test' },
      ]) {
        assert.equal((await request('/book-requests', 'POST', invalid, a.token)).status, 400);
      }
      const payload = {
        title: 'Đọc sách hiệu quả',
        author: 'Tác giả A',
        isbn: '978-TEST',
        reason: 'Cần cho môn học',
        MaDocGia: b.user.id,
        TrangThai: 'DaBoSung',
      };
      const attempts = await Promise.all([
        request('/book-requests', 'POST', payload, a.token),
        request('/book-requests', 'POST', payload, a.token),
      ]);
      assert.deepEqual(attempts.map((r) => r.status).sort(), [201, 409]);
      const created = attempts.find((r) => r.status === 201).data;
      assert.equal(created.MaDocGia, a.user.id);
      assert.equal(created.TrangThai, 'Moi');
      assert.ok(created.MaYeuCau.startsWith('YC-'));
      assert.equal(created.KhoaTrung, undefined);
      assert.equal(
        (
          await request(
            '/book-requests',
            'POST',
            { ...payload, title: 'doc sach hieu qua', author: 'TAC GIA A' },
            a.token,
          )
        ).status,
        409,
      );
      assert.equal((await request('/book-requests', 'GET', undefined, b.token)).data.length, 0);
      assert.equal((await request('/book-requests', 'GET', undefined, staff)).data.length, 1);
      assert.equal(
        (await request('/book-requests/' + created._id, 'PATCH', { action: 'cancel' }, b.token))
          .status,
        403,
      );
      assert.equal(
        (
          await request(
            '/book-requests/' + created._id,
            'PATCH',
            { status: 'TuChoi', response: 'Không phù hợp' },
            a.token,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            '/book-requests/' + created._id,
            'PATCH',
            { status: 'DaBoSung', response: 'Đã nhập' },
            staff,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            '/book-requests/' + created._id,
            'PATCH',
            { status: 'TuChoi', response: '' },
            staff,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            '/book-requests/' + created._id,
            'PATCH',
            { status: 'DangXemXet', response: 'Đang liên hệ nhà xuất bản' },
            staff,
          )
        ).status,
        200,
      );
      assert.equal(
        (await request('/book-requests/' + created._id, 'PATCH', { action: 'cancel' }, a.token))
          .status,
        409,
      );
      const publisher = await NhaXuatBan.create({ MaNXB: 'NXBT', TenNXB: 'Test', DiaChi: 'Test' });
      const book = await Sach.create({
        MaSach: 'ST',
        TenSach: payload.title,
        NguonGocTacGia: payload.author,
        TheLoai: ['Giáo dục'],
        MoTa: 'Test',
        DonGia: 100000,
        SoQuyen: 2,
        NamXuatBan: 2026,
        MaNXB: publisher._id,
      });
      const fulfilled = await request(
        '/book-requests/' + created._id,
        'PATCH',
        {
          status: 'DaBoSung',
          response: 'Sách đã được bổ sung, mời bạn đăng ký mượn.',
          bookId: book.id,
        },
        staff,
      );
      assert.equal(fulfilled.status, 200);
      assert.equal(fulfilled.data.MaSach, book.id);
      assert.ok(fulfilled.data.NgayXuLy);
      const own = (await request('/book-requests', 'GET', undefined, a.token)).data[0];
      assert.equal(own.MaSach._id, book.id);
      assert.equal(own.MaSach.SoQuyen, 2);
      assert.equal(own.NhanVien.HoTenNV, 'Test Librarian');
      assert.match(own.PhanHoi, /bổ sung/);
      assert.equal(own.KhoaTrung, undefined);
      assert.equal(
        (
          await request(
            '/book-requests/' + created._id,
            'PATCH',
            { status: 'TuChoi', response: 'Đổi ý' },
            staff,
          )
        ).status,
        409,
      );
      const retry = await request('/book-requests', 'POST', payload, a.token);
      assert.equal(retry.status, 201); // Completed requests do not block future proposals.
      assert.equal(
        (await request('/book-requests/' + retry.data._id, 'PATCH', { action: 'cancel' }, a.token))
          .status,
        200,
      );
      const rejected = await request(
        '/book-requests',
        'POST',
        { title: 'Sách khác', reason: 'Nghiên cứu' },
        b.token,
      );
      assert.equal(
        (
          await request(
            '/book-requests/' + rejected.data._id,
            'PATCH',
            { status: 'TuChoi', response: 'Chưa phù hợp ngân sách hiện tại.' },
            staff,
          )
        ).status,
        200,
      );
      const ownB = (await request('/book-requests', 'GET', undefined, b.token)).data;
      assert.equal(ownB.length, 1);
      assert.equal(ownB[0].TrangThai, 'TuChoi');
      await DocGia.updateOne({ _id: a.user.id }, { BiKhoa: true });
      assert.equal(
        (await request('/book-requests', 'POST', { title: 'Một tựa mới', reason: 'Test' }, a.token))
          .status,
        403,
      );
      assert.equal(await YeuCauBoSungSach.countDocuments(), 3);
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await mongoose.disconnect();
      await mongo.stop();
    }
  },
);
