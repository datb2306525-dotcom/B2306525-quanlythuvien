import { test } from 'node:test';
import assert from 'node:assert/strict';
test(
  'MongoDB: reservations, pickup codes, reader locks, covers, reports and atomic stock',
  { skip: process.env.RUN_DB_TEST !== '1', timeout: 180000 },
  async () => {
    const { MongoMemoryReplSet } = await import('mongodb-memory-server');
    const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    let server;
    const mongoose = (await import('mongoose')).default;
    try {
      process.env.MONGODB_URI = mongo.getUri('library_test');
      process.env.JWT_SECRET = 'integration-test-secret-longer-than-32-characters';
      process.env.PORT = '0';
      // Exercise startup migration against the previous active-loan index.
      await mongoose.connect(process.env.MONGODB_URI);
      await mongoose.connection.collection('THEODOIMUONSACH').createIndex(
        { MaDocGia: 1, MaSach: 1 },
        {
          unique: true,
          partialFilterExpression: { TrangThai: { $in: ['ChoDuyet', 'DangMuon'] } },
        },
      );
      await mongoose.disconnect();
      ({ server } = await import('../src/app.js'));
      if (!server.listening) await new Promise((r) => server.once('listening', r));
      const base = 'http://127.0.0.1:' + server.address().port + '/api';
      const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
      const returnDay = new Date(Date.now() + 7 * 3600000 + 7 * 86400000)
        .toISOString()
        .slice(0, 10);
      const registration = { borrowDate: today, returnDate: returnDay, responsibility: true };
      const request = async (path, method = 'GET', body, token) => {
        const r = await fetch(base + path, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: 'Bearer ' + token } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        return { status: r.status, data: await r.json() };
      };
      const { NhanVien, Sach, NhaXuatBan, TheoDoiMuonSach } =
        await import('../src/models/index.js');
      const bcrypt = (await import('bcryptjs')).default;
      await NhanVien.create({
        MSNV: 'NVTEST',
        HoTenNV: 'Test Admin',
        Password: await bcrypt.hash('TestAdmin123', 4),
        Email: 'admin@test.vn',
        ChucVu: 'Admin',
        DiaChi: 'Test',
        SoDienThoai: '0900000000',
      });
      const publisher = await NhaXuatBan.create({
        MaNXB: 'NXBT',
        TenNXB: 'Test Publisher',
        DiaChi: 'Test',
      });
      const book = await Sach.create({
        MaSach: 'STEST',
        TenSach: 'Python cơ bản',
        NguonGocTacGia: 'Test Author',
        TheLoai: 'Công nghệ',
        MoTa: 'Lập trình Python từ con số 0',
        DonGia: 100000,
        SoQuyen: 1,
        NamXuatBan: 2025,
        MaNXB: publisher._id,
      });
      // Previous single-genre records are migrated without losing book data.
      await Sach.collection.updateOne({ _id: book._id }, { $set: { TheLoai: 'Công nghệ' } });
      await (await import('../src/initializeModels.js')).initializeModels();
      assert.deepEqual((await Sach.collection.findOne({ _id: book._id })).TheLoai, ['Công nghệ']);
      for (const broken of ['["Công nghệ", "Khoa học"]', ['["Công nghệ", "Khoa học"]']]) {
        await Sach.collection.updateOne({ _id: book._id }, { $set: { TheLoai: broken } });
        await (await import('../src/initializeModels.js')).initializeModels();
        assert.deepEqual((await Sach.collection.findOne({ _id: book._id })).TheLoai, [
          'Công nghệ',
          'Khoa học',
        ]);
        const science = await request('/books?category=' + encodeURIComponent('Khoa học'));
        assert.ok(science.data.some((b) => b._id === book.id));
      }
      await Sach.updateOne({ _id: book._id }, { $set: { TheLoai: ['Công nghệ'] } });
      const signup = (i) =>
        request('/auth/register', 'POST', {
          HoLot: 'Test',
          Ten: 'Reader' + i,
          Email: `reader${i}@test.vn`,
          Password: 'Reader123',
          NgaySinh: '2003-01-01',
          Phai: 'Nam',
          DiaChi: 'Test',
          DienThoai: '0900000000',
        });
      const a = await signup(1),
        b = await signup(2);
      assert.equal(a.status, 201);
      assert.equal(b.status, 201);
      const reader = a.data.token,
        other = b.data.token;
      const admin = (
        await request('/auth/login', 'POST', {
          email: 'admin@test.vn',
          password: 'TestAdmin123',
          portal: 'admin',
        })
      ).data.token;
      assert.ok(admin);
      assert.equal((await request('/auth/profile')).status, 401);
      assert.equal((await request('/auth/profile', 'GET', undefined, admin)).status, 403);
      const initialProfile = (await request('/auth/profile', 'GET', undefined, reader)).data;
      assert.equal(initialProfile.Email, 'reader1@test.vn');
      assert.equal(initialProfile.Password, undefined);
      assert.equal(initialProfile.GoogleId, undefined);
      const edited = await request(
        '/auth/profile',
        'PATCH',
        {
          HoLot: 'Nguyễn Văn',
          Ten: 'Đạt',
          DiaChi: 'Cần Thơ',
          DienThoai: '0912345678',
          Email: 'hijacked@test.vn',
          BiKhoa: true,
          role: 'Admin',
          Password: 'ChangedPassword',
          _id: b.data.user.id,
        },
        reader,
      );
      assert.equal(edited.status, 200);
      assert.equal(edited.data.user.name, 'Nguyễn Văn Đạt');
      assert.equal(edited.data.user.role, 'Reader');
      assert.equal(edited.data.profile.Email, 'reader1@test.vn');
      assert.equal(edited.data.profile.Password, undefined);
      assert.equal(
        (await request('/auth/me', 'GET', undefined, reader)).data.name,
        'Nguyễn Văn Đạt',
      );
      assert.equal((await request('/auth/profile', 'GET', undefined, other)).data.DiaChi, 'Test');
      for (const body of [
        { Ten: ' ' },
        { NgaySinh: '2999-01-01' },
        { NgaySinh: '2024-02-31' },
        { Phai: 'Invalid' },
        { Email: 'ignored@test.vn' },
      ]) {
        assert.equal((await request('/auth/profile', 'PATCH', body, reader)).status, 400);
      }
      assert.equal((await request('/auth/profile', 'PATCH', { Ten: 'Staff' }, admin)).status, 403);
      assert.equal(
        (
          await request('/auth/login', 'POST', {
            email: 'admin@test.vn',
            password: 'TestAdmin123',
            portal: 'reader',
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await request('/auth/login', 'POST', {
            email: 'reader1@test.vn',
            password: 'Reader123',
            portal: 'admin',
          })
        ).status,
        401,
      );
      assert.equal((await request('/auth/me', 'GET', undefined, reader)).data.role, 'Reader');
      assert.equal((await request('/reports')).status, 401);
      assert.equal(
        (await request('/reports', 'POST', { bookId: book.id, content: '   ' }, reader)).status,
        400,
      );
      assert.equal(
        (await request('/reports', 'POST', { bookId: book.id, content: 'Test' }, admin)).status,
        403,
      );
      const report = await request(
        '/reports',
        'POST',
        { bookId: book.id, content: 'Sách rách trang' },
        reader,
      );
      assert.equal(report.status, 201);
      assert.equal((await request('/reports', 'GET', undefined, other)).data.length, 0);
      assert.equal((await request('/reports', 'GET', undefined, admin)).data.length, 1);
      assert.equal(
        (
          await request(
            '/reports/' + report.data._id,
            'PATCH',
            {
              status: 'DaXuLy',
              response: 'Tự đóng',
            },
            reader,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            '/reports/' + report.data._id,
            'PATCH',
            {
              status: 'DaXuLy',
              response: '',
            },
            admin,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            '/reports/' + report.data._id,
            'PATCH',
            {
              status: 'DangXuLy',
              response: 'Đã tiếp nhận',
            },
            admin,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request(
            '/reports/' + report.data._id,
            'PATCH',
            {
              status: 'DaXuLy',
              response: 'Đã thay bản sách mới',
            },
            admin,
          )
        ).status,
        200,
      );
      const readerReports = (await request('/reports', 'GET', undefined, reader)).data;
      assert.equal(readerReports[0].PhanHoi, 'Đã thay bản sách mới');
      const overview = await request('/admin/stats', 'GET', undefined, admin);
      assert.equal(overview.data.available, 1);
      assert.equal(overview.data.pendingReports, 0);
      assert.equal(overview.data.inventory[0].titles, 1);
      assert.equal((await request('/admin/readers', 'GET', undefined, reader)).status, 403);
      assert.equal((await request('/books', 'POST', { TenSach: 'Bad' }, reader)).status, 403);
      assert.equal((await request('/loans', 'POST', { bookId: book.id }, reader)).status, 400);
      assert.equal(
        (
          await request(
            '/loans',
            'POST',
            { bookId: book.id, ...registration, responsibility: false },
            reader,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            '/loans',
            'POST',
            { bookId: book.id, ...registration, returnDate: today },
            reader,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            '/loans',
            'POST',
            { bookId: book.id, ...registration, borrowDate: '2020-01-01' },
            reader,
          )
        ).status,
        400,
      );
      const l1 = await request('/loans', 'POST', { bookId: book.id, ...registration }, reader);
      assert.equal(l1.status, 201);
      assert.equal(
        (await request('/loans', 'POST', { bookId: book.id, ...registration }, reader)).status,
        409,
      );
      const l2 = await request('/loans', 'POST', { bookId: book.id, ...registration }, other);
      assert.equal(l2.status, 201);
      assert.equal(
        (await request('/loans/' + l1.data._id, 'PATCH', { action: 'approve' }, reader)).status,
        403,
      );
      assert.equal(
        (await request('/loans/' + l1.data._id, 'PATCH', { action: 'cancel' }, other)).status,
        403,
      );
      const approvals = await Promise.all(
        [l1, l2].map((l) => request('/loans/' + l.data._id, 'PATCH', { action: 'approve' }, admin)),
      );
      assert.deepEqual(approvals.map((r) => r.status).sort(), [200, 400]);
      assert.equal((await Sach.findById(book.id)).SoQuyen, 0);
      const approved = approvals.find((r) => r.status === 200).data;
      assert.equal(approved.TrangThai, 'ChoNhan');
      assert.ok(approved.MaPhieu.startsWith('PM-'));
      assert.equal(
        (await request('/loans/' + approved._id, 'PATCH', { action: 'return' }, admin)).status,
        400,
      );
      assert.equal(
        (
          await request(
            '/loans/' + approved._id,
            'PATCH',
            { action: 'handover', code: 'WRONG' },
            admin,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            '/loans/' + approved._id,
            'PATCH',
            { action: 'handover', code: approved.MaPhieu },
            reader,
          )
        ).status,
        403,
      );
      const handover = await request(
        '/loans/' + approved._id,
        'PATCH',
        { action: 'handover', code: approved.MaPhieu },
        admin,
      );
      assert.equal(handover.status, 200);
      assert.equal(handover.data.TrangThai, 'DangMuon');
      assert.ok(handover.data.NgayGiao);
      assert.equal(
        (
          await request(
            '/loans/' + approved._id,
            'PATCH',
            { action: 'handover', code: approved.MaPhieu },
            admin,
          )
        ).status,
        400,
      );
      const approvedToken = String(approved.MaDocGia) === a.data.user.id ? reader : other;
      await TheoDoiMuonSach.updateOne(
        { _id: approved._id },
        { $set: { HanTra: new Date(Date.now() - 86400000) } },
      );
      const returned = await request(
        '/loans/' + approved._id,
        'PATCH',
        { action: 'return', condition: 'Hỏng', compensation: 50000, note: 'Rách bìa' },
        admin,
      );
      assert.equal(returned.status, 200);
      assert.ok(returned.data.TienPhat >= 5000);
      assert.equal(returned.data.TienBoiThuong, 50000);
      assert.equal((await Sach.findById(book.id)).SoQuyen, 0);
      assert.equal(
        (await request('/loans/' + approved._id, 'PATCH', { action: 'return' }, admin)).status,
        400,
      );
      assert.equal(
        (await request('/loans', 'POST', { bookId: book.id, ...registration }, approvedToken))
          .status,
        400,
      );
      assert.equal(
        (await request('/loans/' + approved._id, 'PATCH', { action: 'pay' }, approvedToken)).status,
        403,
      );
      assert.equal(
        (await request('/loans/' + approved._id, 'PATCH', { action: 'pay' }, admin)).status,
        200,
      );
      assert.equal(
        (await request('/loans/' + approved._id, 'PATCH', { action: 'pay' }, admin)).status,
        400,
      );
      const visible = await request('/loans', 'GET', undefined, reader);
      assert.ok(visible.data.every((l) => l.MaDocGia._id === a.data.user.id));
      const ai = await request('/ai/search', 'POST', {
        question: 'Tôi muốn học Python từ con số 0',
      });
      assert.equal(ai.status, 200);
      assert.equal(ai.data.results[0].bookId, book.id);
      assert.equal(ai.data.results[0].available, false);
      assert.equal(
        (await request('/ai/search', 'POST', { question: 'thiên văn lượng tử' })).data.results
          .length,
        0,
      );
      const normalBook = await Sach.create({
        MaSach: 'SNORMAL',
        TenSach: 'Python thực hành',
        NguonGocTacGia: 'Test Author',
        TheLoai: 'Công nghệ',
        DonGia: 100000,
        SoQuyen: 1,
        NamXuatBan: 2025,
        MaNXB: publisher._id,
      });
      const normalLoan = await request(
        '/loans',
        'POST',
        { bookId: normalBook.id, ...registration },
        reader,
      );
      assert.equal(normalLoan.status, 201);
      assert.equal(
        (await request('/loans/' + normalLoan.data._id, 'PATCH', { action: 'approve' }, admin))
          .status,
        200,
      );
      const ready = (await request('/loans', 'GET', undefined, reader)).data.find(
        (l) => l._id === normalLoan.data._id,
      );
      assert.equal(
        (
          await request(
            '/loans/' + ready._id,
            'PATCH',
            { action: 'handover', code: ready.MaPhieu },
            admin,
          )
        ).status,
        200,
      );
      const normalReturn = await request(
        '/loans/' + normalLoan.data._id,
        'PATCH',
        { action: 'return', condition: 'Bình thường', compensation: 0 },
        admin,
      );
      assert.equal(normalReturn.status, 200);
      assert.equal(normalReturn.data.TienPhat, 0);
      assert.equal((await Sach.findById(normalBook.id)).SoQuyen, 1);
      // Pickup cancellation restores the reserved copy and duplicate reservations stay blocked.
      const reserve = await request(
        '/loans',
        'POST',
        { bookId: normalBook.id, ...registration },
        reader,
      );
      assert.equal(reserve.status, 201);
      assert.equal(
        (await request('/loans/' + reserve.data._id, 'PATCH', { action: 'approve' }, admin)).status,
        200,
      );
      assert.equal(
        (await request('/loans', 'POST', { bookId: normalBook.id, ...registration }, reader))
          .status,
        409,
      );
      assert.equal((await Sach.findById(normalBook.id)).SoQuyen, 0);
      // Locking applies immediately to existing tokens and blocks handover.
      assert.equal(
        (
          await request(
            '/admin/readers/' + a.data.user.id + '/lock',
            'PATCH',
            { locked: true, reason: 'Vi phạm nội quy' },
            reader,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            '/admin/readers/' + a.data.user.id + '/lock',
            'PATCH',
            { locked: true, reason: '' },
            admin,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            '/admin/readers/' + a.data.user.id + '/lock',
            'PATCH',
            { locked: true, reason: 'Vi phạm nội quy' },
            admin,
          )
        ).status,
        200,
      );
      assert.equal((await request('/loans', 'GET', undefined, reader)).status, 403);
      assert.equal(
        (await request('/auth/login', 'POST', { email: 'reader1@test.vn', password: 'Reader123' }))
          .status,
        403,
      );
      assert.equal(
        (
          await request(
            '/loans/' + reserve.data._id,
            'PATCH',
            { action: 'handover', code: 'WRONG' },
            admin,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            '/admin/readers/' + a.data.user.id + '/lock',
            'PATCH',
            { locked: false },
            admin,
          )
        ).status,
        200,
      );
      assert.equal(
        (await request('/loans/' + reserve.data._id, 'PATCH', { action: 'cancel' }, reader)).status,
        200,
      );
      assert.equal((await Sach.findById(normalBook.id)).SoQuyen, 1);
      // Cover upload is persisted with catalog metadata and rejects unsafe image formats.
      const image =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/YQAAAAASUVORK5CYII=';
      const saved = await request(
        '/books/' + normalBook.id,
        'PUT',
        { AnhBia: image, DanhMuc: 'Giáo trình', TheLoai: ['Công nghệ', 'Khoa học'] },
        admin,
      );
      assert.equal(saved.status, 200);
      assert.equal(saved.data.AnhBia, image);
      assert.deepEqual(saved.data.TheLoai, ['Công nghệ', 'Khoa học']);
      for (const serialized of ['["Công nghệ", "Khoa học"]', ['["Công nghệ", "Khoa học"]']]) {
        const repaired = await request(
          '/books/' + normalBook.id,
          'PUT',
          { TheLoai: serialized },
          admin,
        );
        assert.equal(repaired.status, 200);
        assert.deepEqual(repaired.data.TheLoai, ['Công nghệ', 'Khoa học']);
      }
      for (const genre of ['Công nghệ', 'Khoa học']) {
        const results = await request('/books?category=' + encodeURIComponent(genre));
        assert.ok(results.data.some((b) => b._id === normalBook.id));
      }
      assert.ok(
        !(await request('/books?category=' + encodeURIComponent('Lịch sử'))).data.some(
          (b) => b._id === normalBook.id,
        ),
      );
      assert.ok((await request('/books?q=khoa%20hoc')).data.some((b) => b._id === normalBook.id));
      for (const invalid of [[], [' '], [123], null]) {
        assert.equal(
          (await request('/books/' + normalBook.id, 'PUT', { TheLoai: invalid }, admin)).status,
          400,
        );
      }
      const summary = (await request('/admin/stats', 'GET', undefined, admin)).data;
      assert.equal(summary.available, 1); // Multiple genre memberships must not double total stock.
      assert.ok(summary.inventory.some((row) => row._id === 'Khoa học' && row.titles === 1));
      assert.equal(
        (
          await request(
            '/books/' + normalBook.id,
            'PUT',
            { AnhBia: 'data:image/svg+xml;base64,PHN2Zz4=' },
            admin,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            '/books/' + normalBook.id,
            'PUT',
            { AnhBia: 'data:image/png;base64,SGVsbG8=' },
            admin,
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            '/books?catalog=' + encodeURIComponent('Giáo trình') + '&publisher=' + publisher.id,
          )
        ).data.length,
        1,
      );
      const rec = await request('/recommendations', 'GET', undefined, reader);
      assert.equal(rec.status, 200);
      assert.equal(rec.data.personalized, true);
      assert.ok(rec.data.books.every((b) => b._id !== normalBook.id));
    } finally {
      if (server) await new Promise((r) => server.close(r));
      await mongoose.disconnect();
      await mongo.stop();
    }
  },
);
