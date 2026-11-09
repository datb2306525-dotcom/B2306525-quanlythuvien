<script setup>
import { useLibraryContext } from '../composables/useLibrary';
const { chatOpen, question, chat, chatBusy, detail, ask } = useLibraryContext();
</script>

<template>
  <button
    class="chat-launcher"
    @click="chatOpen = !chatOpen"
    :aria-expanded="chatOpen"
  >
    <i :class="'bi bi-' + (chatOpen ? 'x-lg' : 'stars')"></i><span>Hỏi Athena</span
    ><span class="online-dot"></span>
  </button>
  <section
    v-if="chatOpen"
    class="chat-panel"
    aria-label="Trợ lý tìm sách"
  >
    <header>
      <span class="chat-avatar"><i class="bi bi-stars"></i></span>
      <div><b>Athena Assistant</b><small>Tìm sách từ dữ liệu thư viện</small></div>
      <button
        class="icon-button"
        aria-label="Đóng trò chuyện"
        @click="chatOpen = false"
      >
        <i class="bi bi-x-lg"></i>
      </button>
    </header>
    <div class="chat-body">
      <div class="chat-intro">
        <i class="bi bi-stars"></i>
        <h3>Hôm nay bạn muốn khám phá gì?</h3>
        <p>Tôi giúp bạn tìm sách có trong danh mục. Mỗi gợi ý đều gắn với một cuốn sách thực tế.</p>
        <button @click="ask('Tôi muốn học Python từ con số 0')">
          Tôi muốn học Python từ con số 0 ↗</button
        ><button @click="ask('Tìm sách về bảo mật mạng máy tính có ví dụ thực hành')">
          Sách về bảo mật mạng có thực hành ↗</button
        ><button @click="ask('Gợi ý sách quản trị kinh doanh cho người mới')">
          Quản trị kinh doanh cho người mới ↗
        </button>
      </div>
      <div
        v-for="(m, i) in chat"
        :key="i"
        class="chat-message"
        :class="m.role"
      >
        <p>{{ m.text }}</p>
        <button
          v-for="r in m.results"
          :key="r.bookId"
          class="chat-result"
          @click="detail(r.book)"
        >
          <b>{{ r.book.TenSach }} ↗</b><small>{{ r.reason }}</small
          ><span :class="r.available ? 'text-success' : 'text-danger'">{{
            r.available ? 'Có sẵn ' + r.book.SoQuyen + ' bản' : 'Hiện hết sách'
          }}</span>
        </button>
      </div>
      <p
        v-if="chatBusy"
        class="muted"
      >
        Đang kiểm tra danh mục…
      </p>
    </div>
    <form @submit.prevent="ask()">
      <input
        v-model="question"
        maxlength="1000"
        aria-label="Câu hỏi tìm sách"
        placeholder="Mô tả cuốn sách bạn đang tìm..."
      /><button
        class="btn btn-navy"
        :disabled="chatBusy || !question.trim()"
        aria-label="Gửi câu hỏi"
      >
        <i class="bi bi-arrow-up"></i>
      </button>
    </form>
    <small class="chat-disclaimer">Tìm kiếm theo chủ đề và từ khóa · Không tạo tên sách mới</small>
  </section>
</template>
