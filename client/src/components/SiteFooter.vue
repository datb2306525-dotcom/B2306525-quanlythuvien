<script setup>
import { useLibraryContext } from '../composables/useLibrary';
const { chatOpen, chat, navigate } = useLibraryContext();
</script>

<template>
  <footer>
    <div class="container-wide footer-inner">
      <a
        class="brand"
        href="/"
        @click.prevent="navigate('home')"
        ><i class="bi bi-book"></i
        ><span>ATHENA<small>Không ngừng đọc. Không ngừng lớn lên.</small></span></a
      ><span>© {{ new Date().getFullYear() }} Athena Library. Kết nối bạn với tri thức.</span
      ><button
        class="text-link"
        @click="chatOpen = true"
      >
        Cần hỗ trợ? <i class="bi bi-chat-dots"></i>
      </button>
    </div>
  </footer>
</template>
