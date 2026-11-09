import 'dotenv/config';
import mongoose from 'mongoose';
import { initializeModels } from './initializeModels.js';
import bcrypt from 'bcryptjs';
import { NhaXuatBan, Sach, DocGia, NhanVien } from './models/index.js';
await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/QuanLyMuonSach', {
  autoIndex: false,
});
await initializeModels();
try {
  const publisher = await NhaXuatBan.findOneAndUpdate(
    { MaNXB: 'NXB001' },
    {
      $setOnInsert: {
        MaNXB: 'NXB001',
        TenNXB: 'Nhà xuất bản Tri Thức',
        DiaChi: 'Hà Nội, Việt Nam',
      },
    },
    { upsert: true, new: true },
  );
  const data = [
    [
      'S001',
      'Python Crash Course',
      'Eric Matthes',
      'Công nghệ',
      2023,
      320000,
      8,
      '#31556b',
      'Python từ con số 0. Học lập trình cơ bản qua dự án và ví dụ thực hành.',
    ],
    [
      'S002',
      'The Psychology of Money',
      'Morgan Housel',
      'Kinh tế',
      2020,
      189000,
      6,
      '#eee4cc',
      'Tâm lý học về tiền, quản lý tài chính cá nhân và đầu tư.',
    ],
    [
      'S003',
      'Atomic Habits',
      'James Clear',
      'Phát triển bản thân',
      2018,
      169000,
      12,
      '#e8e2d4',
      'Thói quen nguyên tử. Xây dựng thói quen tốt và thay đổi bản thân.',
    ],
    [
      'S004',
      'A Brief History of Time',
      'Stephen Hawking',
      'Khoa học',
      2017,
      210000,
      4,
      '#1d3646',
      'Lược sử thời gian, vũ trụ, thiên văn và vật lý.',
    ],
    [
      'S005',
      'The Design of Everyday Things',
      'Don Norman',
      'Nghệ thuật',
      2013,
      245000,
      5,
      '#b44c38',
      'Thiết kế lấy con người làm trung tâm, tư duy thiết kế và trải nghiệm người dùng.',
    ],
    [
      'S006',
      'Artificial Intelligence: A Modern Approach',
      'Stuart Russell · Peter Norvig',
      'Công nghệ',
      2021,
      550000,
      3,
      '#435a4d',
      'Trí tuệ nhân tạo AI, machine learning và thuật toán dành cho sinh viên đã có kiến thức lập trình.',
    ],
    [
      'S007',
      'Computer Networking: A Top-Down Approach',
      'James Kurose · Keith Ross',
      'Công nghệ',
      2021,
      420000,
      7,
      '#7b4353',
      'Mạng máy tính, bảo mật mạng security và ví dụ thực hành giao thức.',
    ],
    [
      'S008',
      'The Personal MBA',
      'Josh Kaufman',
      'Kinh tế',
      2020,
      250000,
      5,
      '#b88a44',
      'Nhập môn quản trị kinh doanh business management cho người mới bắt đầu.',
    ],
    [
      'S009',
      'Nhà giả kim',
      'Paulo Coelho',
      'Văn học',
      2020,
      89000,
      9,
      '#c38d54',
      'Hành trình tìm kiếm ước mơ và ý nghĩa cuộc sống.',
    ],
    [
      'S010',
      'Sapiens: Lược sử loài người',
      'Yuval Noah Harari',
      'Lịch sử',
      2019,
      269000,
      4,
      '#c6b59b',
      'Lịch sử nhân loại, văn minh và xã hội.',
    ],
  ];
  for (const [
    MaSach,
    TenSach,
    NguonGocTacGia,
    TheLoai,
    NamXuatBan,
    DonGia,
    SoQuyen,
    MauBia,
    MoTa,
  ] of data)
    await Sach.updateOne(
      { MaSach },
      {
        $setOnInsert: {
          MaSach,
          TenSach,
          NguonGocTacGia,
          TheLoai,
          NamXuatBan,
          DonGia,
          SoQuyen,
          MauBia,
          MoTa,
          MaNXB: publisher._id,
        },
      },
      { upsert: true },
    );
  await NhanVien.updateOne(
    { MSNV: 'NV001' },
    {
      $setOnInsert: {
        MSNV: 'NV001',
        HoTenNV: 'Nguyễn Minh Anh',
        Email: 'admin@athena.vn',
        Password: await bcrypt.hash('Admin@123', 12),
        ChucVu: 'Admin',
        DiaChi: 'Cần Thơ',
        SoDienThoai: '0901234567',
      },
    },
    { upsert: true },
  );
  await DocGia.updateOne(
    { MaDocGia: 'DG001' },
    {
      $setOnInsert: {
        MaDocGia: 'DG001',
        HoLot: 'Trần Minh',
        Ten: 'An',
        Email: 'reader@athena.vn',
        Password: await bcrypt.hash('Reader@123', 12),
        NgaySinh: new Date('2003-05-12'),
        Phai: 'Nam',
        DiaChi: 'Ninh Kiều, Cần Thơ',
        DienThoai: '0912345678',
        LoaiDocGia: 'Sinh viên',
      },
    },
    { upsert: true },
  );
  await Promise.all([Sach.init(), DocGia.init(), NhanVien.init()]);
  console.log(
    'Đã tạo dữ liệu mẫu. Admin: admin@athena.vn / Admin@123; Reader: reader@athena.vn / Reader@123',
  );
} finally {
  await mongoose.disconnect();
}
