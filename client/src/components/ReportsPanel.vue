<script setup>
import { ref, computed } from 'vue';
import { useLibraryContext } from '../composables/useLibrary';
const { reports, isStaff, busy, date, updateReport } = useLibraryContext();
const filter = ref('');
const labels = { Moi: 'Mới tiếp nhận', DangXuLy: 'Đang xử lý', DaXuLy: 'Đã xử lý' };
const visible = computed(() =>
  reports.value.filter((r) => !filter.value || r.TrangThai === filter.value),
);
</script>

<template>
  <section class="panel mt-4">
    <div class="section-heading">
      <h3>Báo cáo & phản hồi về sách</h3>
      <select
        v-model="filter"
        class="form-select w-auto"
        aria-label="Lọc trạng thái báo cáo"
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
    <p
      v-if="!visible.length"
      class="muted"
    >
      Chưa có phản hồi ở trạng thái này.
    </p>
    <article
      v-for="r in visible"
      :key="r._id"
      class="border rounded p-3 mb-3"
    >
      <h4>{{ r.MaSach?.TenSach || 'Sách không còn tồn tại' }}</h4>
      <small class="muted"
        >{{ date(r.createdAt) }} · {{ r.MaDocGia?.HoLot }} {{ r.MaDocGia?.Ten }}</small
      >
      <p class="report-text mt-2">{{ r.NoiDung }}</p>
      <form
        v-if="isStaff"
        @submit.prevent="updateReport(r)"
      >
        <label
          >Trạng thái
          <select
            v-model="r.TrangThai"
            class="form-select"
          >
            <option
              v-for="(label, key) in labels"
              :key="key"
              :value="key"
            >
              {{ label }}
            </option>
          </select>
        </label>
        <label class="d-block mt-2"
          >Kết quả xử lý / trả lời độc giả
          <textarea
            v-model="r.PhanHoi"
            class="form-control"
            maxlength="2000"
            :required="r.TrangThai === 'DaXuLy'"
            rows="3"
          ></textarea>
        </label>
        <button
          class="btn btn-navy mt-2"
          :disabled="busy"
        >
          Lưu xử lý
        </button>
      </form>
      <template v-else>
        <span class="status-pill">{{ labels[r.TrangThai] }}</span>
        <p
          v-if="r.PhanHoi"
          class="report-text mt-2"
        >
          Thư viện phản hồi: {{ r.PhanHoi }}
        </p>
      </template>
    </article>
  </section>
</template>
