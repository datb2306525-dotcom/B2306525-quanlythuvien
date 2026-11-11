<script setup>
import BookRequestsPanel from '../components/BookRequestsPanel.vue';
import { useLibraryContext } from '../composables/useLibrary';
const { user, openAuth } = useLibraryContext();
</script>

<template>
  <main class="container-wide personal-page book-requests-page">
    <div class="eyebrow dark">BUILD OUR COLLECTION TOGETHER</div>
    <h1>Yêu cầu bổ sung sách</h1>
    <p class="muted mb-4">Cùng xây dựng một thư viện gần hơn với nhu cầu đọc của bạn.</p>
    <BookRequestsPanel v-if="user" />
    <div
      v-else
      class="empty-state"
    >
      <i class="bi bi-journal-plus"></i>
      <h3>Cuốn sách bạn muốn đọc, chúng tôi muốn lắng nghe</h3>
      <p>Đăng nhập tài khoản độc giả để gửi phiếu và theo dõi phản hồi từ thư viện.</p>
      <button
        class="btn btn-navy"
        @click="openAuth"
      >
        Đăng nhập để gửi yêu cầu
      </button>
    </div>
  </main>
</template>
