<script setup>
import { ref, computed } from 'vue';
import { useLibraryContext } from '../composables/useLibrary';
const {
  page,
  user,
  loans,
  modal,
  selected,
  busy,
  adminTab,
  returnForm,
  pickupCode,
  isStaff,
  labels,
  money,
  date,
  navigate,
  loanAction,
} = useLibraryContext();
const search = ref('');
const status = ref('');
const norm = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();
const visibleLoans = computed(() =>
  loans.value.filter(
    (l) =>
      (!status.value || l.TrangThai === status.value) &&
      norm([l.MaSach?.TenSach, l.MaDocGia?.HoLot, l.MaDocGia?.Ten, l.MaPhieu].join(' ')).includes(
        norm(search.value.trim()),
      ),
  ),
);
</script>

<template>
  <section
    v-if="(page === 'loans' && user) || (page === 'admin' && isStaff && adminTab === 'loans')"
    class="container-wide loans-section"
  >
    <div class="d-flex gap-2 mb-3 flex-wrap">
      <input
        v-model="search"
        class="form-control flex-grow-1"
        style="max-width: 520px"
        aria-label="Tìm phiếu mượn"
        placeholder="Tìm theo tên sách, tên độc giả, mã phiếu mượn…"
      />
      <select
        v-model="status"
        class="form-select w-auto"
        aria-label="Lọc trạng thái phiếu"
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
    </div>
    <div
      v-if="!visibleLoans.length"
      class="empty-state"
    >
      <i class="bi bi-journal"></i>
      <h3>Không có phiếu mượn phù hợp</h3>
      <button
        v-if="!isStaff"
        class="text-link"
        @click="navigate('catalog')"
      >
        Khám phá sách ngay →
      </button>
    </div>
    <p
      v-if="!isStaff && visibleLoans.some((l) => l.TrangThai === 'ChoNhan')"
      class="policy-note"
    >
      Phiếu đã duyệt: mang mã phiếu và thông tin độc giả đến thư viện đúng lịch để nhận sách.
    </p>
    <div
      v-if="visibleLoans.length"
      class="panel table-responsive"
    >
      <table class="table align-middle">
        <thead>
          <tr>
            <th>Mã phiếu / Sách / Độc giả</th>
            <th>Ngày mượn</th>
            <th>Hạn trả / Ngày trả</th>
            <th>Trạng thái</th>
            <th>Phạt & bồi thường</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="l in visibleLoans"
            :key="l._id"
          >
            <td>
              <strong
                v-if="l.MaPhieu"
                class="d-block loan-code"
                >{{ l.MaPhieu }}</strong
              >
              <small
                v-else
                class="d-block muted"
                >Chờ duyệt để cấp mã phiếu</small
              >
              <b>{{ l.MaSach?.TenSach || 'Sách không tồn tại' }}</b
              ><small class="d-block muted">{{ l.MaDocGia?.HoLot }} {{ l.MaDocGia?.Ten }}</small>
            </td>
            <td>
              {{ date(l.NgayGiao || l.NgayMuonDuKien || l.NgayMuon)
              }}<small class="d-block muted">{{
                ['ChoDuyet', 'ChoNhan'].includes(l.TrangThai) ? 'Dự kiến nhận' : 'Ngày nhận sách'
              }}</small>
            </td>
            <td>
              {{ date(l.HanTra || l.NgayTraDuKien)
              }}<small
                v-if="l.NgayTra"
                class="d-block"
                >Đã trả: {{ date(l.NgayTra) }}</small
              >
            </td>
            <td>
              <span
                class="status-pill"
                :class="l.TrangThai"
                >{{ labels[l.TrangThai] }}</span
              >
            </td>
            <td>
              {{ money(l.PhatHienTai + l.TienBoiThuong)
              }}<small class="d-block muted"
                >{{
                  l.DaThanhToan
                    ? 'Đã thanh toán'
                    : l.TrangThai === 'DangMuon'
                      ? 'Tạm tính đến hiện tại'
                      : 'Chưa thanh toán'
                }}<span v-if="l.TinhTrangTra !== 'Bình thường'">
                  · {{ l.TinhTrangTra }}</span
                ></small
              ><small
                v-if="l.GhiChu"
                class="d-block"
                >{{ l.GhiChu }}</small
              >
            </td>
            <td>
              <div class="d-flex gap-2 flex-wrap">
                <template v-if="isStaff"
                  ><button
                    v-if="l.TrangThai === 'ChoDuyet'"
                    class="btn btn-sm btn-navy"
                    :disabled="busy"
                    @click="loanAction(l, 'approve')"
                  >
                    Duyệt</button
                  ><button
                    v-if="['ChoDuyet', 'ChoNhan'].includes(l.TrangThai)"
                    class="btn btn-sm btn-outline-danger"
                    :disabled="busy"
                    @click="loanAction(l, 'reject')"
                  >
                    Từ chối</button
                  ><button
                    v-if="l.TrangThai === 'ChoNhan'"
                    class="btn btn-sm btn-navy"
                    :disabled="busy"
                    @click="
                      selected = l;
                      pickupCode = '';
                      modal = 'handover';
                    "
                  >
                    Xác nhận giao sách
                  </button>
                  <button
                    v-if="l.TrangThai === 'DangMuon'"
                    class="btn btn-sm btn-navy"
                    @click="
                      selected = l;
                      returnForm = { condition: 'Bình thường', compensation: 0, note: '' };
                      modal = 'return';
                    "
                  >
                    Nhận trả</button
                  ><button
                    v-if="
                      l.TrangThai === 'DaTra' && !l.DaThanhToan && l.TienPhat + l.TienBoiThuong > 0
                    "
                    :disabled="busy"
                    class="btn btn-sm btn-outline-success"
                    @click="
                      selected = l;
                      modal = 'payment';
                    "
                  >
                    Thu phí
                  </button></template
                ><button
                  v-else-if="['ChoDuyet', 'ChoNhan'].includes(l.TrangThai)"
                  class="btn btn-sm btn-outline-danger"
                  :disabled="busy"
                  @click="loanAction(l, 'cancel')"
                >
                  Hủy yêu cầu
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
