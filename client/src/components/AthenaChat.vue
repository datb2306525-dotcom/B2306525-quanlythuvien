<script setup>
import { nextTick, ref, watch } from 'vue';
import { useLibraryContext } from '../composables/useLibrary';
const { chatOpen, question, chat, chatBusy, chatConfig, externalAIConsent, detail, ask } =
  useLibraryContext();
const chatBody = ref(null);
const chatInput = ref(null);

watch(
  () => [chat.value.length, chatBusy.value, chatOpen.value],
  async () => {
    await nextTick();
    if (chatBody.value) chatBody.value.scrollTop = chatBody.value.scrollHeight;
  },
);
watch(chatOpen, async (open) => {
  if (open) {
    await nextTick();
    chatInput.value?.focus();
  }
});
function newConversation() {
  if (!chatBusy.value) {
    chat.value = [];
    externalAIConsent.value = false;
    question.value = '';
    chatInput.value?.focus();
  }
}
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
    aria-label="Athena — trò chuyện về sách và thư viện"
  >
    <header>
      <span class="chat-avatar"><i class="bi bi-stars"></i></span>
      <div><b>Athena Assistant</b><small>Cùng bạn tìm cuốn sách phù hợp</small></div>
      <button
        class="icon-button chat-reset"
        aria-label="Bắt đầu cuộc trò chuyện mới"
        title="Cuộc trò chuyện mới"
        :disabled="chatBusy"
        @click="newConversation"
      >
        <i class="bi bi-arrow-counterclockwise"></i>
      </button>
      <button
        class="icon-button"
        aria-label="Đóng trò chuyện"
        @click="chatOpen = false"
      >
        <i class="bi bi-x-lg"></i>
      </button>
    </header>
    <div
      ref="chatBody"
      class="chat-body"
      role="log"
      aria-live="polite"
      :aria-busy="chatBusy"
    >
      <div
        v-if="!chat.length"
        class="chat-intro"
      >
        <i class="bi bi-stars"></i>
        <h3>Hôm nay bạn muốn khám phá gì?</h3>
        <p>
          Kể tôi nghe điều bạn quan tâm. Tôi có thể giới thiệu nội dung sách, gợi ý theo nhu cầu và
          hướng dẫn bạn mượn sách.
        </p>
        <button
          :disabled="chatBusy"
          @click="ask('Tôi hay trì hoãn việc học, có sách nào giúp tôi xây dựng thói quen không?')"
        >
          Tôi muốn bớt trì hoãn và tập trung hơn ↗
        </button>
        <button
          :disabled="chatBusy"
          @click="ask('Giới thiệu ngắn nội dung sách Atomic Habits')"
        >
          Giới thiệu nội dung Atomic Habits ↗
        </button>
        <button
          :disabled="chatBusy"
          @click="ask('Hướng dẫn tôi quy trình đăng ký mượn và nhận sách')"
        >
          Làm sao để mượn và nhận sách? ↗
        </button>
      </div>
      <div
        v-for="(m, i) in chat"
        :key="i"
        class="chat-message"
        :class="m.role"
      >
        <p class="chat-text">{{ m.text }}</p>
        <small
          v-if="m.aiUnavailable"
          class="chat-mode-note"
          >{{
            m.aiError === 'quota'
              ? 'AI đã đạt giới hạn lượt dùng. Athena vẫn hỗ trợ bằng dữ liệu thư viện; bạn có thể thử lại sau.'
              : m.aiError === 'configuration'
                ? 'Dịch vụ AI chưa sẵn sàng. Athena đang hỗ trợ bằng dữ liệu thư viện.'
                : 'AI hiện chưa phản hồi. Athena đang hỗ trợ bằng dữ liệu và hướng dẫn thư viện.'
          }}</small
        >
        <small
          v-if="m.consentRequired"
          class="chat-mode-note"
          >Câu trả lời này chỉ dùng dữ liệu thư viện. Bạn có thể bật trò chuyện AI ở phần lựa chọn
          bên dưới.</small
        >
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
        <small
          v-if="m.results?.length"
          class="chat-stock-note"
          >Tồn kho được kiểm tra khi trả lời; có thể thay đổi trước khi thủ thư duyệt.</small
        >
        <div
          v-if="m.external?.length"
          class="chat-external"
        >
          <b>Tra cứu ngoài thư viện</b>
          <small
            >Liên kết mở trang tìm kiếm; chưa xác minh kết quả, nội dung, nơi bán hay khả năng
            mượn.</small
          >
          <a
            v-for="(source, sourceIndex) in m.external"
            :key="sourceIndex"
            :href="source.url"
            target="_blank"
            rel="noopener noreferrer"
          >
            <strong v-if="source.title">{{ source.title }} — {{ source.author }}</strong>
            <span v-if="source.title"
              >Tựa sách gợi ý ngoài danh mục, chưa xác minh thông tin xuất bản.</span
            >
            <span v-if="source.reason">{{ source.reason }}</span>
            <span>{{ source.label }} <i class="bi bi-box-arrow-up-right"></i></span>
          </a>
        </div>
        <button
          v-if="m.failed"
          class="text-link mt-2"
          :disabled="chatBusy"
          @click="ask(question)"
        >
          Gửi lại câu hỏi
        </button>
      </div>
      <p
        v-if="chatBusy"
        class="muted"
      >
        Athena đang suy nghĩ và đối chiếu danh mục…
      </p>
    </div>
    <div
      v-if="chatConfig.requiresConsent"
      class="chat-privacy"
    >
      <label>
        <input
          v-model="externalAIConsent"
          type="checkbox"
          :disabled="chatBusy"
        />
        <span
          >Tôi đồng ý gửi tin nhắn và ngữ cảnh từ lúc bật lựa chọn này tới Google Gemini để trò
          chuyện AI.</span
        >
      </label>
      <small
        >Google có thể dùng nội dung ở gói miễn phí để cải thiện sản phẩm. Tránh chia sẻ thông tin
        nhạy cảm. Bỏ chọn để chỉ dùng dữ liệu thư viện; việc này không thu hồi nội dung đã
        gửi.</small
      >
      <a
        href="https://ai.google.dev/gemini-api/terms"
        target="_blank"
        rel="noopener noreferrer"
        >Điều khoản Gemini API ↗</a
      >
    </div>
    <form @submit.prevent="ask()">
      <input
        ref="chatInput"
        v-model="question"
        maxlength="1000"
        aria-label="Nhắn Athena về sách hoặc nhu cầu của bạn"
        placeholder="Hỏi về sách, chia sẻ nhu cầu của bạn..."
      /><button
        class="btn btn-navy"
        :disabled="chatBusy || !question.trim()"
        aria-label="Gửi câu hỏi"
      >
        <i class="bi bi-arrow-up"></i>
      </button>
    </form>
    <small class="chat-disclaimer"
      >Athena ghi nhớ hội thoại khi đang mở trang · AI có thể nhầm, hãy đối chiếu thông tin
      sách</small
    >
  </section>
</template>
