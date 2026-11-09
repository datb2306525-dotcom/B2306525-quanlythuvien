<script setup>
import { useLibraryContext } from '../composables/useLibrary';
const {
  page,
  books,
  genreLabel,
  category,
  query,
  loading,
  selected,
  chatOpen,
  categories,
  filtered,
  navigate,
  detail,
  ask,
} = useLibraryContext();
</script>

<template>
  <main v-if="page === 'home' || page === 'catalog'">
    <section class="hero">
      <div class="hero-orbit orbit-one"></div>
      <div class="hero-orbit orbit-two"></div>
      <div class="container-wide hero-inner">
        <div class="hero-copy">
          <div class="eyebrow"><span></span> MỞ TRANG SÁCH. MỞ TƯƠNG LAI.</div>
          <h1>Cả một thế giới tri thức.<br /><em>Chờ bạn khám phá.</em></h1>
          <p>
            Tìm cuốn sách tiếp theo, nuôi dưỡng những ý tưởng lớn.<br />Hành trình của bạn bắt đầu
            từ một trang sách.
          </p>
          <div class="hero-tags">
            <span><i class="bi bi-check2-circle"></i> Tra cứu dễ dàng</span
            ><span><i class="bi bi-check2-circle"></i> Mượn sách trực tuyến</span
            ><span><i class="bi bi-stars"></i> Trợ lý thông minh</span>
          </div>
        </div>
        <div
          class="hero-art"
          aria-hidden="true"
        >
          <div class="art-ring"></div>
          <div class="hero-book book-back">
            <small>STEPHEN HAWKING</small><strong>A BRIEF<br />HISTORY<br />OF TIME</strong>
            <div class="cosmos">✧</div>
          </div>
          <div class="hero-book book-front">
            <small>THE INTERNATIONAL BESTSELLER</small
            ><strong>THE<br />PSYCHOLOGY<br /><em>of</em> MONEY</strong>
            <div class="tree">♧</div>
            <span>MORGAN HOUSEL</span>
          </div>
          <div class="floating-label">
            <i class="bi bi-bookmark-heart-fill"></i
            ><span>Mỗi cuốn sách<br /><b>Một chân trời mới</b></span>
          </div>
          <span class="art-star">✦</span>
        </div>
      </div>
    </section>
    <div class="container-wide search-container">
      <form
        class="search-box"
        @submit.prevent="navigate('catalog')"
      >
        <i class="bi bi-search"></i
        ><input
          v-model="query"
          aria-label="Tìm kiếm sách"
          placeholder="Tìm tên sách, tác giả hoặc từ khóa bạn quan tâm..."
        /><select
          v-model="category"
          aria-label="Chọn thể loại"
        >
          <option
            v-for="c in categories"
            :key="c"
          >
            {{ c }}
          </option></select
        ><button
          class="btn btn-gold"
          type="submit"
        >
          Tìm kiếm <i class="bi bi-arrow-right"></i>
        </button>
      </form>
      <div class="search-hint">
        Gợi ý tìm kiếm:
        <button
          @click="
            query = 'Python';
            navigate('catalog');
          "
        >
          Python</button
        ><button
          @click="
            query = 'Tâm lý';
            navigate('catalog');
          "
        >
          Tâm lý học</button
        ><button
          @click="
            query = 'Thiết kế';
            navigate('catalog');
          "
        >
          Tư duy thiết kế</button
        ><button
          class="ask-inline"
          @click="chatOpen = true"
        >
          <i class="bi bi-stars"></i> Chưa biết đọc gì? Hỏi trợ lý Athena
        </button>
      </div>
    </div>
    <div class="container-wide content-layout">
      <div class="main-column">
        <div class="section-heading">
          <div>
            <div class="eyebrow dark">THE BOOKSHELF</div>
            <h2>{{ page === 'catalog' ? 'Khám phá kho sách' : 'Những trang sách mới' }}</h2>
            <p>Một chút cảm hứng cho hành trình khám phá của bạn.</p>
          </div>
          <button
            v-if="page === 'home'"
            class="text-link"
            @click="navigate('catalog')"
          >
            Xem tất cả <i class="bi bi-arrow-right"></i></button
          ><span
            v-else
            class="muted"
            >{{ filtered.length }} cuốn sách</span
          >
        </div>
        <div class="category-tabs">
          <button
            v-for="c in categories"
            :key="c"
            :class="{ selected: category === c }"
            @click="category = c"
          >
            {{ c }}
          </button>
        </div>
        <div
          v-if="loading"
          class="empty-state"
        >
          <div class="spinner-border spinner-border-sm"></div>
          Đang tải kho sách…
        </div>
        <div
          v-else-if="!filtered.length"
          class="empty-state"
        >
          <i class="bi bi-search"></i>
          <h3>Chưa tìm thấy sách</h3>
          <p>
            {{
              books.length
                ? 'Thử từ khóa hoặc thể loại khác.'
                : 'Hãy kết nối MongoDB và chạy dữ liệu mẫu để khám phá kho sách.'
            }}
          </p>
        </div>
        <div class="book-grid">
          <article
            v-for="(b, i) in page === 'home' ? filtered.slice(0, 5) : filtered"
            :key="b._id"
            class="book-card"
          >
            <button
              class="cover-wrap"
              :style="{ '--cover': b.MauBia }"
              @click="detail(b)"
              :aria-label="'Xem ' + b.TenSach"
            >
              <span
                class="book-status"
                :class="{ unavailable: !b.SoQuyen }"
                >{{ b.SoQuyen ? 'CÓ SẴN' : 'HẾT SÁCH' }}</span
              ><img
                v-if="b.AnhBia"
                :src="b.AnhBia"
                :alt="b.TenSach"
                class="uploaded-cover"
              /><span
                v-else
                class="book-cover"
                ><span class="cover-author">{{ b.NguonGocTacGia }}</span
                ><strong>{{ b.TenSach }}</strong
                ><span class="cover-art">{{ ['◉', '♧', '✳', '✧', '◒'][i % 5] }}</span
                ><span class="cover-bottom">ATHENA COLLECTION</span></span
              ><span class="cover-action"
                >Xem chi tiết <i class="bi bi-arrow-up-right"></i
              ></span></button
            ><span class="book-category">{{ genreLabel(b.TheLoai) }}</span
            ><button
              class="book-title"
              @click="detail(b)"
            >
              {{ b.TenSach }}
            </button>
            <p class="author">{{ b.NguonGocTacGia }}</p>
            <div class="book-meta">
              <span><i class="bi bi-journal-bookmark"></i> {{ b.SoQuyen }} bản có sẵn</span
              ><button
                @click="detail(b)"
                aria-label="Chi tiết sách"
              >
                <i class="bi bi-arrow-up-right"></i>
              </button>
            </div>
          </article>
        </div>
        <section class="ai-banner">
          <div class="ai-symbol"><i class="bi bi-stars"></i></div>
          <div>
            <span class="eyebrow dark">TRỢ LÝ TÌM SÁCH</span>
            <h3>Bạn có câu hỏi. Athena có gợi ý.</h3>
            <p>Chỉ cần nói điều bạn muốn học, chúng tôi sẽ tìm sách trong thư viện.</p>
          </div>
          <button
            class="btn btn-navy"
            @click="chatOpen = true"
          >
            Khám phá ngay <i class="bi bi-arrow-up-right"></i>
          </button>
        </section>
        <section class="reading-note">
          <div class="section-heading">
            <div>
              <div class="eyebrow dark">A LITTLE INSPIRATION</div>
              <h2>Dừng một chút, đọc một trang</h2>
            </div>
            <i class="bi bi-quote"></i>
          </div>
          <blockquote>
            “Đọc sách hay cũng giống như trò chuyện với những bộ óc tuyệt vời nhất của những thế kỷ
            đã trôi qua.”<cite>RENÉ DESCARTES</cite>
          </blockquote>
        </section>
      </div>
      <aside class="right-column">
        <section class="spotlight">
          <div class="eyebrow dark"><i class="bi bi-fire"></i> ĐƯỢC YÊU THÍCH</div>
          <h3>Cuốn sách của tuần</h3>
          <button
            class="spotlight-cover"
            @click="
              books.find((b) => b.MaSach === 'S003') &&
              detail(books.find((b) => b.MaSach === 'S003'))
            "
          >
            <small>THE #1 NEW YORK TIMES BESTSELLER</small><strong>Atomic<br />Habits</strong
            ><span>THAY ĐỔI TÍ HON<br />HIỆU QUẢ BẤT NGỜ</span><b>JAMES CLEAR</b>
          </button>
          <h4>Thói quen nguyên tử</h4>
          <p>James Clear</p>
          <div class="stars">★★★★★ <span>Góc đọc Athena</span></div>
          <p class="spotlight-desc">
            Những thay đổi nhỏ hôm nay tạo nên phiên bản tốt hơn của bạn ngày mai.
          </p>
          <button
            class="text-link"
            @click="
              query = 'Atomic';
              navigate('catalog');
            "
          >
            Khám phá cuốn sách <i class="bi bi-arrow-right"></i>
          </button>
        </section>
        <section class="library-info">
          <div class="icon-circle"><i class="bi bi-bank"></i></div>
          <h3>Thư viện luôn chào bạn</h3>
          <p>Một không gian yên tĩnh.<br />Hàng ngàn điều để khám phá.</p>
          <hr />
          <div><span>Thứ 2 – Thứ 6</span><b>07:30 – 20:00</b></div>
          <div><span>Thứ 7</span><b>08:00 – 17:00</b></div>
          <div><span>Chủ nhật</span><b class="muted">Đóng cửa</b></div>
          <span class="info-foot"
            ><i class="bi bi-info-circle"></i> Mượn sách tối đa 14 ngày / lượt</span
          >
        </section>
      </aside>
    </div>
  </main>
</template>
