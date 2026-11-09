<script setup>
import { useLibraryContext } from '../composables/useLibrary';
const { page, user, loans, openAuth } = useLibraryContext();
</script>

<template>
  <main
    v-if="page === 'loans'"
    class="container-wide personal-page"
  >
    <div class="eyebrow dark">YOUR READING JOURNEY</div>
    <h1>Tủ sách của tôi</h1>
    <p class="muted">Theo dõi yêu cầu mượn, hạn trả và các khoản phí của bạn.</p>
    <div
      v-if="!user"
      class="empty-state"
    >
      <i class="bi bi-person-circle"></i>
      <h3>Hành trình bắt đầu từ đây</h3>
      <p>Đăng nhập để theo dõi những cuốn sách bạn đang đọc.</p>
      <button
        class="btn btn-navy"
        @click="openAuth"
      >
        Đăng nhập
      </button>
    </div>
  </main>
</template>
