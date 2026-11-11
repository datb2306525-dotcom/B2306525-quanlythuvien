<script setup>
import { computed, ref, watch } from 'vue';
import { api } from '../api';
import { useLibraryContext } from '../composables/useLibrary';

const { user, isStaff, books, query, date, notify, detail } = useLibraryContext();
const rows = ref([]);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const filter = ref('');
const editing = ref(null);
const form = ref({ title: query.value.trim(), author: '', isbn: '', reason: '' });
const processing = ref({ status: 'DangXemXet', response: '', bookId: '' });
const labels = {
  Moi: 'Chờ xem xét',
  DangXemXet: 'Đang xem xét',
  DaBoSung: 'Đã bổ sung',
  TuChoi: 'Từ chối',
  DaHuy: 'Đã hủy',
};
const visible = computed(() =>
  rows.value.filter((row) => !filter.value || row.TrangThai === filter.value),
);

async function loadRequests() {
  rows.value = [];
  editing.value = null;
  if (!user.value) return;
  loading.value = true;
  error.value = '';
  const readerId = user.value.id;
  try {
    const result = await api('/book-requests');
    if (user.value?.id === readerId) rows.value = result;
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await api('/book-requests', { method: 'POST', body: form.value });
    form.value = { title: '', author: '', isbn: '', reason: '' };
    filter.value = '';
    notify('Đã gửi yêu cầu bổ sung sách. Bạn có thể theo dõi phản hồi bên dưới.');
    await loadRequests();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function update(row, body) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await api('/book-requests/' + row._id, { method: 'PATCH', body });
    notify(
      body.action === 'cancel' ? 'Đã hủy phiếu yêu cầu.' : 'Đã cập nhật phản hồi cho độc giả.',
    );
    await loadRequests();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

function edit(row) {
  editing.value = row._id;
  processing.value = {
    status: row.TrangThai === 'Moi' ? 'DangXemXet' : 'DaBoSung',
    response: row.PhanHoi || '',
    bookId: '',
  };
}

async function viewBook(id) {
  try {
    detail(await api('/books/' + id));
  } catch (e) {
    error.value = e.message;
  }
}

watch(() => user.value?.id, loadRequests, { immediate: true });
</script>

<template>
  <section class="book-requests-panel">
    <div
      v-if="error"
      class="alert alert-danger"
      role="alert"
    >
      {{ error }}
    </div>
    <form
      v-if="!isStaff"
      class="panel mb-4"
      @submit.prevent="submit"
    >
      <h2>Đề xuất cuốn sách bạn muốn đọc</h2>
      <p class="muted">
        Chưa tìm được sách mong muốn? Gửi thông tin để thư viện xem xét bổ sung. Phiếu này không
        phải yêu cầu mượn và không bảo đảm sách sẽ được nhập.
      </p>
      <div class="row g-3">
        <label class="col-md-6"
          >Tên sách <span class="text-danger">*</span>
          <input
            v-model="form.title"
            class="form-control"
            required
            maxlength="200"
            placeholder="Tên sách bạn muốn thư viện bổ sung"
          />
        </label>
        <label class="col-md-6"
          >Tác giả (nếu biết)
          <input
            v-model="form.author"
            class="form-control"
            maxlength="200"
            placeholder="Tên tác giả"
          />
        </label>
        <label class="col-md-6"
          >ISBN (nếu biết)
          <input
            v-model="form.isbn"
            class="form-control"
            maxlength="32"
            placeholder="Mã ISBN giúp xác định đúng ấn bản"
          />
        </label>
        <label class="col-12"
          >Lý do đề xuất <span class="text-danger">*</span>
          <textarea
            v-model="form.reason"
            class="form-control"
            required
            maxlength="2000"
            rows="3"
            placeholder="Bạn cần sách để học, nghiên cứu hay tìm hiểu chủ đề nào? Có thể ghi thêm thông tin ấn bản tại đây."
          ></textarea>
        </label>
      </div>
      <button
        class="btn btn-navy mt-3"
        :disabled="busy || !form.title.trim() || !form.reason.trim()"
      >
        {{ busy ? 'Đang gửi…' : 'Gửi yêu cầu thêm sách' }} <i class="bi bi-send"></i>
      </button>
    </form>
    <div class="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
      <h2 class="mb-0">{{ isStaff ? 'Phiếu đề xuất từ độc giả' : 'Yêu cầu đã gửi' }}</h2>
      <div class="d-flex gap-2 align-items-center">
        <select
          v-model="filter"
          class="form-select mt-0"
          aria-label="Lọc trạng thái yêu cầu"
        >
          <option value="">Tất cả trạng thái</option>
          <option
            v-for="(label, key) in labels"
            :key="key"
            :value="key"
          >
            {{ label }}
          </option>
        </select>
        <button
          class="btn btn-outline-secondary"
          :disabled="loading || busy"
          @click="loadRequests"
        >
          Làm mới
        </button>
      </div>
    </div>
    <p
      v-if="isStaff"
      class="muted"
    >
      Thêm sách vào mục Quản lý sách trước khi xác nhận “Đã bổ sung”. Độc giả sẽ thấy trạng thái,
      phản hồi và liên kết sách tại trang Yêu cầu sách.
    </p>
    <div
      v-if="loading"
      class="empty-state"
      role="status"
    >
      Đang tải phiếu yêu cầu…
    </div>
    <div
      v-else-if="!visible.length"
      class="empty-state"
    >
      <i class="bi bi-journal-plus"></i>
      <h3>Chưa có phiếu yêu cầu</h3>
      <p>
        {{
          filter
            ? 'Chưa có phiếu ở trạng thái này.'
            : 'Các đề xuất bổ sung sách sẽ xuất hiện tại đây.'
        }}
      </p>
    </div>
    <article
      v-for="row in visible"
      :key="row._id"
      class="panel mb-3"
    >
      <div class="d-flex justify-content-between gap-3 align-items-start">
        <div>
          <small class="muted">{{ row.MaYeuCau }} · {{ date(row.createdAt) }}</small>
          <h3 class="mt-2">{{ row.TenSach }}</h3>
        </div>
        <span
          class="status-pill"
          :class="{
            ChoDuyet: row.TrangThai === 'Moi',
            DangMuon: row.TrangThai === 'DangXemXet',
            DaTra: row.TrangThai === 'DaBoSung',
          }"
          >{{ labels[row.TrangThai] }}</span
        >
      </div>
      <p class="muted mb-2">
        Tác giả: {{ row.TacGia || 'Chưa cung cấp'
        }}<span v-if="row.ISBN"> · ISBN: {{ row.ISBN }}</span>
      </p>
      <p
        v-if="isStaff"
        class="muted"
      >
        Độc giả: {{ row.MaDocGia?.HoLot }} {{ row.MaDocGia?.Ten }} · {{ row.MaDocGia?.Email }}
      </p>
      <p class="request-copy">{{ row.LyDo }}</p>
      <div
        v-if="row.PhanHoi"
        class="policy-note mb-3"
      >
        <b>Phản hồi từ thư viện</b>
        <p class="request-copy mb-0">{{ row.PhanHoi }}</p>
        <small v-if="row.NgayXuLy"
          >Cập nhật {{ date(row.NgayXuLy)
          }}<span v-if="row.NhanVien"> · {{ row.NhanVien.HoTenNV }}</span></small
        >
      </div>
      <button
        v-if="row.TrangThai === 'DaBoSung' && row.MaSach"
        class="btn btn-navy me-2"
        @click="viewBook(row.MaSach._id)"
      >
        Xem sách đã bổ sung <i class="bi bi-arrow-up-right"></i>
      </button>
      <button
        v-if="!isStaff && row.TrangThai === 'Moi'"
        class="btn btn-outline-danger"
        :disabled="busy"
        @click="update(row, { action: 'cancel' })"
      >
        Hủy yêu cầu
      </button>
      <button
        v-if="isStaff && ['Moi', 'DangXemXet'].includes(row.TrangThai) && editing !== row._id"
        class="btn btn-navy"
        @click="edit(row)"
      >
        Xử lý yêu cầu
      </button>
      <form
        v-if="isStaff && editing === row._id"
        class="request-processing mt-3"
        @submit.prevent="update(row, processing)"
      >
        <label
          >Trạng thái xử lý<select
            v-model="processing.status"
            class="form-select"
            required
          >
            <option
              v-if="row.TrangThai === 'Moi'"
              value="DangXemXet"
            >
              Đang xem xét
            </option>
            <option value="DaBoSung">Đã bổ sung</option>
            <option value="TuChoi">Từ chối</option>
          </select></label
        >
        <label
          v-if="processing.status === 'DaBoSung'"
          class="mt-3"
          >Sách đã thêm vào thư viện<select
            v-model="processing.bookId"
            class="form-select"
            required
          >
            <option
              disabled
              value=""
            >
              Chọn sách trong danh mục
            </option>
            <option
              v-for="book in books"
              :key="book._id"
              :value="book._id"
            >
              {{ book.MaSach }} — {{ book.TenSach }}
            </option>
          </select></label
        >
        <label class="mt-3"
          >Phản hồi cho độc giả<textarea
            v-model="processing.response"
            class="form-control"
            rows="3"
            maxlength="2000"
            :required="processing.status !== 'DangXemXet'"
            placeholder="Kết quả xử lý, lý do từ chối hoặc thông tin bổ sung"
          ></textarea>
        </label>
        <div class="d-flex gap-2 mt-3">
          <button
            class="btn btn-navy"
            :disabled="busy"
          >
            Lưu phản hồi</button
          ><button
            type="button"
            class="btn btn-outline-secondary"
            :disabled="busy"
            @click="editing = null"
          >
            Đóng
          </button>
        </div>
      </form>
    </article>
  </section>
</template>
