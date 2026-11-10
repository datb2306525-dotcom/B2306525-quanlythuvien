<script setup>
import { useLibraryContext } from '../composables/useLibrary';
const {
  user,
  profileForm,
  profileLoading,
  profileError,
  busy,
  today,
  openAuth,
  loadProfile,
  saveProfile,
  requestLogout,
} = useLibraryContext();
</script>

<template>
  <main class="container-wide personal-page">
    <div class="eyebrow dark">TÀI KHOẢN ĐỘC GIẢ</div>
    <h1>Thông tin tài khoản</h1>
    <p class="muted">Cập nhật thông tin để thư viện liên hệ và xử lý yêu cầu mượn sách của bạn.</p>
    <div
      v-if="!user"
      class="empty-state"
    >
      <i class="bi bi-person-circle"></i>
      <h3>Vui lòng đăng nhập để xem hồ sơ</h3>
      <button
        class="btn btn-navy"
        @click="openAuth"
      >
        Đăng nhập
      </button>
    </div>
    <template v-else>
      <div
        v-if="profileError"
        class="alert alert-danger"
        role="alert"
      >
        {{ profileError }}
        <button
          type="button"
          class="btn btn-sm"
          @click="loadProfile"
          :disabled="busy"
        >
          Tải lại hồ sơ
        </button>
      </div>
      <p
        v-if="profileLoading"
        role="status"
      >
        Đang tải thông tin tài khoản…
      </p>
      <form
        v-else-if="profileForm.MaDocGia"
        class="panel"
        @submit.prevent="saveProfile"
      >
        <fieldset :disabled="busy">
          <div class="row g-3">
            <label class="col-md-6"
              >Mã độc giả<input
                :value="profileForm.MaDocGia"
                class="form-control"
                readonly
            /></label>
            <label class="col-md-6"
              >Email<input
                :value="profileForm.Email"
                class="form-control"
                readonly
              /><small class="muted">Email đăng nhập được giữ cố định.</small></label
            >
            <label class="col-md-6"
              >Họ lót<input
                v-model="profileForm.HoLot"
                class="form-control"
                required
                maxlength="100"
                autocomplete="family-name"
            /></label>
            <label class="col-md-6"
              >Tên<input
                v-model="profileForm.Ten"
                class="form-control"
                required
                maxlength="100"
                autocomplete="given-name"
            /></label>
            <label class="col-md-6"
              >Ngày sinh<input
                v-model="profileForm.NgaySinh"
                type="date"
                :max="today()"
                class="form-control"
                required
                autocomplete="bday"
            /></label>
            <label class="col-md-6"
              >Phái<select
                v-model="profileForm.Phai"
                class="form-select"
                required
              >
                <option>Nam</option>
                <option>Nữ</option>
                <option>Khác</option>
              </select></label
            >
            <label class="col-md-6"
              >Số điện thoại<input
                v-model="profileForm.DienThoai"
                type="tel"
                class="form-control"
                required
                maxlength="100"
                autocomplete="tel"
            /></label>
            <label class="col-md-6"
              >Loại độc giả<select
                v-model="profileForm.LoaiDocGia"
                class="form-select"
                required
              >
                <option>Sinh viên</option>
                <option>Giảng viên</option>
              </select></label
            >
            <label class="col-12"
              >Địa chỉ<textarea
                v-model="profileForm.DiaChi"
                class="form-control"
                required
                maxlength="500"
                rows="3"
                autocomplete="street-address"
              ></textarea>
            </label>
          </div>
          <div class="d-flex flex-wrap gap-2 mt-4">
            <button
              class="btn btn-navy"
              :disabled="busy"
            >
              {{ busy ? 'Đang lưu…' : 'Lưu thay đổi' }}
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="loadProfile"
            >
              Tải lại thông tin đã lưu
            </button>
          </div>
        </fieldset>
      </form>
      <button
        type="button"
        class="btn btn-outline-danger mt-4"
        @click="requestLogout"
        :disabled="busy"
      >
        <i class="bi bi-box-arrow-right"></i> Đăng xuất
      </button>
    </template>
  </main>
</template>
