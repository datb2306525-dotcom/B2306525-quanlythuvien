<script setup>
import { useLibraryContext } from '../composables/useLibrary';
const { page, user, category, recommendations, personalized, isStaff, openAuth, detail } =
  useLibraryContext();
</script>

<template>
  <main
    v-if="page === 'recommendations'"
    class="container-wide personal-page"
  >
    <div class="eyebrow dark">CURATED FOR YOU</div>
    <h1>Một cuốn sách, đúng lúc.</h1>
    <p class="muted">
      {{
        personalized
          ? 'Những gợi ý theo thể loại bạn từng mượn.'
          : 'Khám phá các tựa sách trong thư viện. Mượn sách để nhận gợi ý cá nhân hóa.'
      }}
    </p>
    <div
      v-if="!user || isStaff"
      class="empty-state"
    >
      <i class="bi bi-bookmark-heart"></i>
      <h3>Dành riêng cho hành trình của bạn</h3>
      <p>Đăng nhập tài khoản độc giả để xem đề xuất.</p>
      <button
        v-if="!user"
        class="btn btn-navy"
        @click="openAuth"
      >
        Đăng nhập
      </button>
    </div>
    <div
      v-else
      class="recommend-grid"
    >
      <button
        v-for="b in recommendations"
        :key="b._id"
        class="recommend-card"
        @click="detail(b)"
      >
        <img
          v-if="b.AnhBia"
          :src="b.AnhBia"
          :alt="b.TenSach"
          class="cover-preview"
        /><i
          v-else
          class="bi bi-book"
          :style="{ color: b.MauBia }"
        ></i
        ><span class="book-category">{{ b.TheLoai }}</span>
        <h3>{{ b.TenSach }}</h3>
        <p>{{ b.NguonGocTacGia }}</p>
        <small>{{ b.SoQuyen }} bản có sẵn · Xem chi tiết →</small>
      </button>
      <p v-if="!recommendations.length">Chưa có đề xuất mới. Hãy khám phá danh mục sách.</p>
    </div>
  </main>
</template>
