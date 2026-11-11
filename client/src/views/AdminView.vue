<script setup>
import { ref, computed } from 'vue';
import { genresOf } from '../genres';
import LoansTable from '../components/LoansTable.vue';
import ReportsPanel from '../components/ReportsPanel.vue';
import BookRequestsPanel from '../components/BookRequestsPanel.vue';
import { useLibraryContext } from '../composables/useLibrary';
const {
  page,
  user,
  books,
  genreLabel,
  loans,
  stats,
  readers,
  publishers,
  modal,
  selected,
  lockForm,
  busy,
  genreOptions,
  catalogOptions,
  adminTab,
  isStaff,
  money,
  load,
  loadAccount,
  openAuth,
  editBook,
} = useLibraryContext();
const bookQuery = ref(''),
  bookGenre = ref(''),
  bookCatalog = ref(''),
  bookPublisher = ref('');
const norm = (v) =>
  String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();
const managedBooks = computed(() =>
  books.value.filter(
    (b) =>
      (!bookGenre.value || genresOf(b.TheLoai).includes(bookGenre.value)) &&
      (!bookCatalog.value || (b.DanhMuc || 'Sách tham khảo') === bookCatalog.value) &&
      (!bookPublisher.value || b.MaNXB?._id === bookPublisher.value) &&
      norm(b.MaSach + ' ' + b.TenSach + ' ' + b.NguonGocTacGia).includes(
        norm(bookQuery.value.trim()),
      ),
  ),
);
</script>

<template>
  <main
    v-if="page === 'admin'"
    class="admin-shell container-wide"
  >
    <aside
      v-if="isStaff"
      class="admin-sidebar"
    >
      <div class="eyebrow dark">WORKSPACE</div>
      <h2>Quản lý thư viện</h2>
      <p>ATHENA ADMINISTRATION</p>
      <button
        v-for="(label, key) in {
          overview: 'Tổng quan',
          loans: 'Phiếu mượn / trả',
          books: 'Quản lý sách',
          publishers: 'Nhà xuất bản',
          readers: 'Độc giả',
          reports: 'Báo cáo & phản hồi',
          requests: 'Yêu cầu bổ sung sách',
        }"
        :key="key"
        :class="{ selected: adminTab === key }"
        @click="adminTab = key"
      >
        <i
          :class="
            'bi bi-' +
            {
              overview: 'grid',
              loans: 'journal-check',
              books: 'book',
              publishers: 'buildings',
              readers: 'people',
              reports: 'chat-left-text',
              requests: 'journal-plus',
            }[key]
          "
        ></i
        >{{ label }}
      </button>
      <div class="admin-tip">
        <i class="bi bi-shield-check"></i>
        <p>Không gian dành riêng cho thủ thư và quản trị viên.</p>
      </div>
    </aside>
    <section class="admin-content">
      <template v-if="!isStaff"
        ><div class="empty-state">
          <i class="bi bi-shield-lock"></i>
          <h2>Cổng quản trị Athena</h2>
          <p>Đăng nhập bằng tài khoản thủ thư hoặc quản trị viên để tiếp tục.</p>
          <button
            class="btn btn-navy"
            @click="openAuth"
          >
            Đăng nhập quản trị
          </button>
        </div></template
      ><template v-else
        ><div class="section-heading">
          <div>
            <div class="eyebrow dark">LIBRARY MANAGEMENT</div>
            <h1>
              {{
                {
                  overview: 'Tổng quan thư viện',
                  loans: 'Phiếu mượn & trả',
                  books: 'Danh mục sách',
                  publishers: 'Nhà xuất bản',
                  readers: 'Danh sách độc giả',
                  reports: 'Xử lý báo cáo & phản hồi',
                  requests: 'Yêu cầu bổ sung sách',
                }[adminTab]
              }}
            </h1>
            <p>Xin chào {{ user.name }}, chúc bạn một ngày làm việc hiệu quả.</p>
          </div>
          <button
            class="btn btn-outline-secondary"
            @click="
              loadAccount();
              load();
            "
          >
            <i class="bi bi-arrow-clockwise"></i> Làm mới
          </button>
        </div>
        <div
          v-if="adminTab === 'overview'"
          class="stats-grid"
        >
          <div
            v-for="s in [
              { label: 'Đầu sách', value: stats.books, icon: 'book' },
              { label: 'Bản sách sẵn có', value: stats.available, icon: 'bookshelf' },
              { label: 'Phản hồi cần xử lý', value: stats.pendingReports, icon: 'chat-left-text' },
              { label: 'Độc giả', value: stats.readers, icon: 'people' },
              { label: 'Chờ duyệt', value: stats.pending, icon: 'hourglass-split' },
              { label: 'Chờ nhận sách', value: stats.awaitingPickup, icon: 'journal-check' },
              { label: 'Đang mượn', value: stats.borrowing, icon: 'journal-arrow-up' },
              { label: 'Quá hạn', value: stats.overdue, icon: 'exclamation-circle' },
              { label: 'Phí chưa thanh toán', value: money(stats.debt), icon: 'cash-stack' },
            ]"
            :key="s.label"
          >
            <i :class="'bi bi-' + s.icon"></i><span>{{ s.label }}</span
            ><strong>{{ s.value ?? '—' }}</strong>
          </div>
        </div>
        <div
          v-if="adminTab === 'overview'"
          class="panel mt-4"
        >
          <h3>Quy trình lưu thông sách</h3>
          <p>
            Độc giả đăng ký lịch mượn → thủ thư duyệt và cấp mã → đối chiếu mã, xác nhận giao sách →
            nhận trả → xử lý phí nếu có.
          </p>
          <p class="muted">
            Phạt quá hạn: 5.000đ / ngày. Sách hỏng hoặc mất được ghi nhận bồi thường và không tự
            động đưa lại vào kho có sẵn.
          </p>
          <button
            class="btn btn-navy"
            @click="adminTab = 'loans'"
          >
            Xử lý phiếu mượn <i class="bi bi-arrow-right"></i>
          </button>
        </div>
        <div
          v-if="adminTab === 'overview'"
          class="panel table-responsive mt-4"
        >
          <h3>Thống kê sách theo thể loại</h3>
          <table class="table">
            <thead>
              <tr>
                <th>Thể loại</th>
                <th>Đầu sách</th>
                <th>Bản sẵn có</th>
                <th>Lượt mượn</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in stats.inventory"
                :key="row._id"
              >
                <td>{{ row._id }}</td>
                <td>{{ row.titles }}</td>
                <td>{{ row.available }}</td>
                <td>{{ row.borrowed }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <LoansTable v-if="adminTab === 'loans'" />
        <ReportsPanel v-if="adminTab === 'reports'" />
        <BookRequestsPanel v-if="adminTab === 'requests'" />
        <template v-if="adminTab === 'books'"
          ><button
            class="btn btn-navy mb-3"
            @click="editBook()"
          >
            <i class="bi bi-plus-lg"></i> Thêm sách
          </button>
          <div class="row g-2 mb-3">
            <div class="col-12">
              <input
                v-model="bookQuery"
                class="form-control"
                aria-label="Tìm sách quản lý"
                placeholder="Tìm mã sách, tên sách, tác giả…"
              />
            </div>
            <div class="col-md-4">
              <select
                v-model="bookCatalog"
                class="form-select"
                aria-label="Lọc danh mục"
              >
                <option value="">Tất cả danh mục</option>
                <option
                  v-for="g in catalogOptions"
                  :key="g"
                >
                  {{ g }}
                </option>
              </select>
            </div>
            <div class="col-md-4">
              <select
                v-model="bookGenre"
                class="form-select"
                aria-label="Lọc thể loại"
              >
                <option value="">Tất cả thể loại</option>
                <option
                  v-for="g in genreOptions"
                  :key="g"
                >
                  {{ g }}
                </option>
              </select>
            </div>
            <div class="col-md-4">
              <select
                v-model="bookPublisher"
                class="form-select"
                aria-label="Lọc nhà xuất bản"
              >
                <option value="">Tất cả nhà xuất bản</option>
                <option
                  v-for="p in publishers"
                  :key="p._id"
                  :value="p._id"
                >
                  {{ p.TenNXB }}
                </option>
              </select>
            </div>
            <div class="col-12">
              <span class="muted">{{ managedBooks.length }} đầu sách</span>
              <button
                class="btn btn-sm btn-outline-secondary"
                @click="
                  bookQuery = '';
                  bookGenre = '';
                  bookCatalog = '';
                  bookPublisher = '';
                "
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
          <div class="table-responsive panel">
            <table class="table align-middle">
              <thead>
                <tr>
                  <th>Mã sách</th>
                  <th>Tên sách</th>
                  <th>Tác giả</th>
                  <th>Danh mục / Thể loại / NXB</th>
                  <th>Bản sẵn có</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="b in managedBooks"
                  :key="b._id"
                >
                  <td>{{ b.MaSach }}</td>
                  <td>
                    <img
                      v-if="b.AnhBia"
                      :src="b.AnhBia"
                      alt=""
                      class="cover-thumbnail me-2"
                    />{{ b.TenSach }}
                  </td>
                  <td>{{ b.NguonGocTacGia }}</td>
                  <td>
                    {{ b.DanhMuc || 'Sách tham khảo'
                    }}<small class="d-block"
                      >{{ genreLabel(b.TheLoai) }} · {{ b.MaNXB?.TenNXB }}</small
                    >
                  </td>
                  <td>{{ b.SoQuyen }}</td>
                  <td>
                    <button
                      class="btn btn-sm btn-outline-secondary"
                      @click="editBook(b)"
                    >
                      Chỉnh sửa
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div></template
        ><template v-if="adminTab === 'publishers'"
          ><button
            class="btn btn-navy mb-3"
            @click="modal = 'publisher'"
          >
            <i class="bi bi-plus-lg"></i> Thêm nhà xuất bản
          </button>
          <div class="panel table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Mã NXB</th>
                  <th>Tên nhà xuất bản</th>
                  <th>Địa chỉ</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in publishers"
                  :key="p._id"
                >
                  <td>{{ p.MaNXB }}</td>
                  <td>{{ p.TenNXB }}</td>
                  <td>{{ p.DiaChi }}</td>
                </tr>
              </tbody>
            </table>
          </div></template
        >
        <div
          v-if="adminTab === 'readers'"
          class="panel table-responsive"
        >
          <table class="table">
            <thead>
              <tr>
                <th>Mã độc giả</th>
                <th>Họ tên</th>
                <th>Email</th>
                <th>Điện thoại</th>
                <th>Loại độc giả</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in readers"
                :key="r._id"
              >
                <td>{{ r.MaDocGia }}</td>
                <td>{{ r.HoLot }} {{ r.Ten }}</td>
                <td>{{ r.Email }}</td>
                <td>{{ r.DienThoai }}</td>
                <td>{{ r.LoaiDocGia }}</td>
                <td>
                  <span :class="r.BiKhoa ? 'text-danger' : 'text-success'">{{
                    r.BiKhoa ? 'Đã khóa' : 'Hoạt động'
                  }}</span
                  ><small
                    v-if="r.BiKhoa"
                    class="d-block"
                    >{{ r.LyDoKhoa }}</small
                  >
                </td>
                <td>
                  <button
                    class="btn btn-sm"
                    :class="r.BiKhoa ? 'btn-outline-success' : 'btn-outline-danger'"
                    :disabled="busy"
                    @click="
                      selected = r;
                      lockForm = { locked: !r.BiKhoa, reason: '' };
                      modal = 'readerLock';
                    "
                  >
                    {{ r.BiKhoa ? 'Mở khóa' : 'Khóa tài khoản' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div></template
      >
    </section>
  </main>
</template>
