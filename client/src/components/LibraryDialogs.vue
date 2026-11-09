<script setup>
import { useLibraryContext } from '../composables/useLibrary';
const {
  today,
  returnDateLimit,
  borrowForm,
  openBorrow,
  pickupCode,
  lockForm,
  saveReaderLock,
  genreOptions,
  catalogOptions,
  uploadCover,
  page,
  user,
  reportContent,
  sendReport,
  error,
  publishers,
  modal,
  selected,
  busy,
  authTab,
  loginForm,
  registerForm,
  bookForm,
  publisherForm,
  returnForm,
  isStaff,
  money,
  date,
  authenticate,
  detail,
  borrow,
  loanAction,
  saveBook,
  savePublisher,
} = useLibraryContext();
</script>

<template>
  <div
    v-if="modal"
    class="modal-overlay"
    @click.self="modal = ''"
    @keydown.esc="modal = ''"
    role="presentation"
  >
    <section
      class="app-modal"
      role="dialog"
      aria-modal="true"
      :aria-label="modal === 'auth' ? 'Đăng nhập' : 'Chi tiết và thao tác'"
    >
      <button
        class="modal-close icon-button"
        @click="modal = ''"
        aria-label="Đóng"
      >
        <i class="bi bi-x-lg"></i>
      </button>
      <div
        v-if="error"
        class="alert alert-danger"
        role="alert"
      >
        {{ error }}
      </div>
      <template v-if="modal === 'auth'"
        ><div class="eyebrow dark">WELCOME TO ATHENA</div>
        <h2>
          {{
            authTab === 'register'
              ? 'Tạo tài khoản độc giả'
              : page === 'admin'
                ? 'Đăng nhập quản trị'
                : 'Chào mừng bạn trở lại'
          }}
        </h2>
        <p class="muted">Một tài khoản, cả một thế giới tri thức.</p>
        <form @submit.prevent="authenticate">
          <template v-if="authTab === 'register'"
            ><div class="row g-3">
              <label class="col-7"
                >Họ lót<input
                  v-model="registerForm.HoLot"
                  required
                  class="form-control" /></label
              ><label class="col-5"
                >Tên<input
                  v-model="registerForm.Ten"
                  required
                  class="form-control" /></label
              ><label class="col-6"
                >Ngày sinh<input
                  v-model="registerForm.NgaySinh"
                  type="date"
                  :max="new Date().toISOString().slice(0, 10)"
                  required
                  class="form-control" /></label
              ><label class="col-6"
                >Phái<select
                  v-model="registerForm.Phai"
                  class="form-select"
                >
                  <option>Nam</option>
                  <option>Nữ</option>
                  <option>Khác</option>
                </select></label
              ><label class="col-12"
                >Email<input
                  v-model="registerForm.Email"
                  type="email"
                  required
                  class="form-control" /></label
              ><label class="col-12"
                >Mật khẩu<input
                  v-model="registerForm.Password"
                  type="password"
                  minlength="8"
                  required
                  class="form-control"
                  autocomplete="new-password" /></label
              ><label class="col-6"
                >Điện thoại<input
                  v-model="registerForm.DienThoai"
                  required
                  class="form-control" /></label
              ><label class="col-6"
                >Loại độc giả<select
                  v-model="registerForm.LoaiDocGia"
                  class="form-select"
                >
                  <option>Sinh viên</option>
                  <option>Giảng viên</option>
                </select></label
              ><label class="col-12"
                >Địa chỉ<input
                  v-model="registerForm.DiaChi"
                  required
                  class="form-control"
              /></label></div></template
          ><template v-else
            ><label
              >Email<input
                v-model="loginForm.email"
                type="email"
                required
                class="form-control"
                autocomplete="username" /></label
            ><label
              >Mật khẩu<input
                v-model="loginForm.password"
                type="password"
                required
                class="form-control"
                autocomplete="current-password" /></label></template
          ><button
            class="btn btn-navy w-100 mt-4"
            :disabled="busy"
          >
            {{ busy ? 'Đang xử lý…' : authTab === 'register' ? 'Đăng ký' : 'Đăng nhập' }}
            <i class="bi bi-arrow-right"></i>
          </button>
        </form>
        <button
          v-if="page !== 'admin'"
          class="text-link mt-3"
          @click="
            authTab = authTab === 'login' ? 'register' : 'login';
            error = '';
          "
        >
          {{
            authTab === 'login' ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'
          }}
        </button></template
      >
      <template v-if="modal === 'detail'"
        ><div class="eyebrow dark">{{ selected.TheLoai }} · {{ selected.MaSach }}</div>
        <h2>{{ selected.TenSach }}</h2>
        <img
          v-if="selected.AnhBia"
          :src="selected.AnhBia"
          :alt="selected.TenSach"
          class="cover-preview"
        />
        <p class="muted">{{ selected.NguonGocTacGia }}</p>
        <p>{{ selected.MoTa }}</p>
        <dl class="detail-data">
          <div>
            <dt>Nhà xuất bản</dt>
            <dd>{{ selected.MaNXB?.TenNXB }}</dd>
          </div>
          <div>
            <dt>Năm xuất bản</dt>
            <dd>{{ selected.NamXuatBan }}</dd>
          </div>
          <div>
            <dt>Giá trị sách</dt>
            <dd>{{ money(selected.DonGia) }}</dd>
          </div>
          <div>
            <dt>Tình trạng hiện tại</dt>
            <dd>{{ selected.SoQuyen }} bản có sẵn</dd>
          </div>
        </dl>
        <div class="policy-note">
          <i class="bi bi-info-circle"></i> Chọn lịch mượn tối đa 14 ngày; nhận sách bằng mã phiếu
          sau khi được duyệt. Phạt quá hạn: 5.000đ/ngày. Sách hỏng hoặc mất có thể phát sinh bồi
          thường.
        </div>
        <button
          v-if="!isStaff"
          class="btn btn-navy w-100 mt-4"
          :disabled="!selected.SoQuyen || busy"
          @click="openBorrow"
        >
          {{ busy ? 'Đang gửi…' : selected.SoQuyen ? 'Đăng ký mượn sách' : 'Hiện chưa có sẵn' }}
          <i class="bi bi-arrow-right"></i>
        </button>
        <button
          v-if="!isStaff"
          class="btn btn-outline-secondary w-100 mt-2"
          @click="user ? ((reportContent = ''), (modal = 'report')) : (modal = 'auth')"
        >
          Báo cáo / phản hồi về sách
        </button>
      </template>
      <template v-if="modal === 'report'">
        <h2>Phản hồi về sách</h2>
        <p>{{ selected.TenSach }}</p>
        <form @submit.prevent="sendReport">
          <label class="d-block"
            >Nội dung báo cáo / phản hồi
            <textarea
              v-model="reportContent"
              class="form-control"
              rows="5"
              maxlength="2000"
              required
              placeholder="Ví dụ: sách bị rách trang, thông tin sách chưa chính xác…"
            ></textarea>
          </label>
          <button
            class="btn btn-navy w-100 mt-3"
            :disabled="busy"
          >
            Gửi phản hồi
          </button>
        </form>
      </template>
      <template v-if="modal === 'borrow'">
        <h2>Đăng ký mượn sách</h2>
        <form @submit.prevent="borrow">
          <label class="d-block"
            >Tên sách<input
              :value="selected.TenSach"
              class="form-control"
              readonly
          /></label>
          <label class="d-block mt-3"
            >Ngày mượn dự kiến<input
              v-model="borrowForm.borrowDate"
              type="date"
              :min="today()"
              class="form-control"
              required
          /></label>
          <label class="d-block mt-3"
            >Ngày trả dự kiến<input
              v-model="borrowForm.returnDate"
              type="date"
              :min="returnDateLimit(1)"
              :max="returnDateLimit(14)"
              class="form-control"
              required
          /></label>
          <p class="muted mt-2">
            Thời hạn mượn tối đa 14 ngày. Mang mã phiếu đã duyệt đến thư viện để nhận sách.
          </p>
          <label class="d-flex gap-2 align-items-start"
            ><input
              v-model="borrowForm.responsibility"
              type="checkbox"
              required
            />
            Tôi xác nhận giữ gìn sách, trả đúng hạn và chịu trách nhiệm về phí quá hạn, hư hỏng hoặc
            mất sách.</label
          >
          <button
            class="btn btn-navy w-100 mt-3"
            :disabled="busy || !borrowForm.responsibility"
          >
            Gửi đăng ký mượn
          </button>
        </form>
      </template>
      <template v-if="modal === 'handover'">
        <h2>Xác nhận giao sách</h2>
        <p>
          {{ selected.MaSach?.TenSach }} · {{ selected.MaDocGia?.HoLot }}
          {{ selected.MaDocGia?.Ten }}
        </p>
        <form @submit.prevent="loanAction(selected, 'handover', { code: pickupCode })">
          <label class="d-block"
            >Mã phiếu độc giả cung cấp<input
              v-model="pickupCode"
              class="form-control"
              required
              autocomplete="off"
          /></label>
          <p class="muted mt-2">Đối chiếu thông tin độc giả và mã phiếu trước khi giao sách.</p>
          <button
            class="btn btn-navy mt-3"
            :disabled="busy"
          >
            Xác nhận đã giao sách
          </button>
        </form>
      </template>
      <template v-if="modal === 'readerLock'">
        <h2>{{ lockForm.locked ? 'Khóa tài khoản độc giả' : 'Mở khóa tài khoản độc giả' }}</h2>
        <p>{{ selected.HoLot }} {{ selected.Ten }} · {{ selected.Email }}</p>
        <form @submit.prevent="saveReaderLock">
          <label
            v-if="lockForm.locked"
            class="d-block"
            >Lý do vi phạm<textarea
              v-model="lockForm.reason"
              class="form-control"
              required
              maxlength="1000"
            ></textarea>
          </label>
          <p v-else>Lý do khóa trước đó: {{ selected.LyDoKhoa }}</p>
          <button
            class="btn btn-navy mt-3"
            :disabled="busy"
          >
            Xác nhận {{ lockForm.locked ? 'khóa' : 'mở khóa' }}
          </button>
        </form>
      </template>
      <template v-if="modal === 'book'"
        ><h2>{{ bookForm._id ? 'Chỉnh sửa sách' : 'Thêm sách mới' }}</h2>
        <form @submit.prevent="saveBook">
          <div class="row g-3">
            <label
              v-for="f in [
                { k: 'MaSach', l: 'Mã sách' },
                { k: 'TenSach', l: 'Tên sách' },
                { k: 'NguonGocTacGia', l: 'Nguồn gốc / Tác giả' },
                { k: 'DonGia', l: 'Đơn giá', t: 'number' },
                { k: 'SoQuyen', l: 'Số quyển có sẵn', t: 'number' },
                { k: 'NamXuatBan', l: 'Năm xuất bản', t: 'number' },
              ]"
              :key="f.k"
              class="col-6"
              >{{ f.l
              }}<input
                v-model="bookForm[f.k]"
                :type="f.t || 'text'"
                :min="f.t === 'number' ? 0 : undefined"
                :step="f.t === 'number' ? 1 : undefined"
                required
                class="form-control" /></label
            ><label class="col-6"
              >Nhà xuất bản<select
                v-model="bookForm.MaNXB"
                class="form-select"
                required
              >
                <option
                  v-for="p in publishers"
                  :key="p._id"
                  :value="p._id"
                >
                  {{ p.TenNXB }}
                </option>
              </select></label
            ><label class="col-6"
              >Thể loại<select
                v-model="bookForm.TheLoai"
                class="form-select"
                required
              >
                <option
                  v-for="g in genreOptions"
                  :key="g"
                >
                  {{ g }}
                </option>
              </select></label
            >
            <label class="col-6"
              >Danh mục<select
                v-model="bookForm.DanhMuc"
                class="form-select"
                required
              >
                <option
                  v-for="g in catalogOptions"
                  :key="g"
                >
                  {{ g }}
                </option>
              </select></label
            >
            <label class="col-12"
              >Ảnh bìa (PNG, JPEG, WebP; tối đa 1 MB)<input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                class="form-control"
                @change="uploadCover"
                :disabled="busy"
            /></label>
            <div
              v-if="bookForm.AnhBia"
              class="col-12"
            >
              <img
                :src="bookForm.AnhBia"
                alt="Xem trước ảnh bìa"
                class="cover-preview"
              /><button
                type="button"
                class="btn btn-sm btn-outline-danger ms-3"
                @click="bookForm.AnhBia = ''"
              >
                Xóa ảnh bìa
              </button>
            </div>
            <label class="col-12"
              >Mô tả<textarea
                v-model="bookForm.MoTa"
                class="form-control"
                rows="3"
              ></textarea></label
            ><label class="col-6"
              >Màu bìa<input
                v-model="bookForm.MauBia"
                type="color"
                class="form-control form-control-color"
            /></label>
          </div>
          <button
            class="btn btn-navy w-100 mt-4"
            :disabled="busy"
          >
            Lưu sách
          </button>
        </form></template
      >
      <template v-if="modal === 'publisher'"
        ><h2>Thêm nhà xuất bản</h2>
        <form @submit.prevent="savePublisher">
          <label
            v-for="(l, k) in { MaNXB: 'Mã NXB', TenNXB: 'Tên nhà xuất bản', DiaChi: 'Địa chỉ' }"
            :key="k"
            >{{ l
            }}<input
              v-model="publisherForm[k]"
              required
              class="form-control" /></label
          ><button
            class="btn btn-navy w-100 mt-4"
            :disabled="busy"
          >
            Lưu nhà xuất bản
          </button>
        </form></template
      >
      <template v-if="modal === 'return'"
        ><h2>Tiếp nhận trả sách</h2>
        <p>{{ selected.MaSach?.TenSach }}</p>
        <form @submit.prevent="loanAction(selected, 'return', returnForm)">
          <label
            >Tình trạng sách<select
              v-model="returnForm.condition"
              class="form-select"
              @change="returnForm.compensation = 0"
            >
              <option>Bình thường</option>
              <option>Hỏng</option>
              <option>Mất</option>
            </select></label
          ><label v-if="returnForm.condition !== 'Bình thường'"
            >Số tiền bồi thường (VNĐ)<input
              v-model.number="returnForm.compensation"
              type="number"
              min="0"
              step="1000"
              required
              class="form-control" /></label
          ><label
            >Ghi chú xử lý<textarea
              v-model="returnForm.note"
              class="form-control"
              maxlength="1000"
            ></textarea>
          </label>
          <p class="policy-note mt-3">
            Phí quá hạn được tính tự động tại thời điểm xác nhận. Sách hỏng/mất không được cộng lại
            vào số sách có sẵn.
          </p>
          <button
            class="btn btn-navy w-100 mt-3"
            :disabled="busy"
          >
            Xác nhận nhận trả
          </button>
        </form></template
      >
      <template v-if="modal === 'payment'"
        ><h2>Xác nhận thu phí</h2>
        <p>
          {{ selected.MaDocGia?.HoLot }} {{ selected.MaDocGia?.Ten }} ·
          {{ selected.MaSach?.TenSach }}
        </p>
        <h3>{{ money(selected.TienPhat + selected.TienBoiThuong) }}</h3>
        <p>Chỉ xác nhận sau khi thủ thư đã nhận đủ tiền từ độc giả.</p>
        <button
          class="btn btn-navy w-100"
          :disabled="busy"
          @click="loanAction(selected, 'pay')"
        >
          Đã nhận tiền — xác nhận thanh toán
        </button></template
      >
    </section>
  </div>
</template>
