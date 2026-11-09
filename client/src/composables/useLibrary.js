import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue';
import { api } from '../api';

export const libraryKey = Symbol('library');

// Shared state and API actions for the reader and staff views.
export function useLibrary() {
  const adminPortal = location.pathname.split('/')[1] === 'admin';
  const sessionKey = adminPortal ? 'athena-admin-' : 'athena-';
  const initialPage = location.pathname.split('/')[1];
  const page = ref(
      ['admin', 'catalog', 'loans', 'recommendations'].includes(initialPage) ? initialPage : 'home',
    ),
    user = ref(null);
  const books = ref([]),
    category = ref('Tất cả'),
    query = ref(''),
    error = ref(''),
    notice = ref(''),
    loading = ref(true),
    loans = ref([]),
    stats = ref({}),
    readers = ref([]),
    publishers = ref([]),
    recommendations = ref([]),
    personalized = ref(false),
    reports = ref([]),
    reportContent = ref('');
  const modal = ref(''),
    selected = ref(null),
    busy = ref(false),
    adminTab = ref('overview'),
    authTab = ref('login'),
    chatOpen = ref(false),
    question = ref(''),
    chat = ref([]),
    chatBusy = ref(false);
  const loginForm = ref({ email: '', password: '' }),
    registerForm = ref({
      HoLot: '',
      Ten: '',
      Email: '',
      Password: '',
      NgaySinh: '',
      Phai: 'Nam',
      DiaChi: '',
      DienThoai: '',
      LoaiDocGia: 'Sinh viên',
    }),
    bookForm = ref({}),
    publisherForm = ref({ MaNXB: '', TenNXB: '', DiaChi: '' }),
    returnForm = ref({ condition: 'Bình thường', compensation: 0, note: '' });
  const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const borrowForm = ref({ borrowDate: today(), returnDate: '', responsibility: false });
  const returnDateLimit = (days) => {
    const start = Date.parse(borrowForm.value.borrowDate);
    return Number.isNaN(start) ? '' : new Date(start + days * 86400000).toISOString().slice(0, 10);
  };
  const pickupCode = ref('');
  const lockForm = ref({ locked: true, reason: '' });
  const genreOptions = computed(() => [
    ...new Set([
      'Công nghệ',
      'Văn học',
      'Kinh tế',
      'Khoa học',
      'Lịch sử',
      'Tâm lý',
      'Kỹ năng sống',
      ...books.value.map((b) => b.TheLoai),
    ]),
  ]);
  const catalogOptions = computed(() => [
    ...new Set([
      'Sách tham khảo',
      'Giáo trình',
      'Sách chuyên khảo',
      'Truyện',
      ...books.value.map((b) => b.DanhMuc).filter(Boolean),
    ]),
  ]);
  function openBorrow() {
    if (!user.value) {
      openAuth();
      return;
    }
    borrowForm.value = {
      borrowDate: today(),
      returnDate: new Date(Date.now() + 7 * 3600000 + 14 * 86400000).toISOString().slice(0, 10),
      responsibility: false,
    };
    error.value = '';
    modal.value = 'borrow';
  }
  async function uploadCover(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
      error.value = 'Chọn ảnh PNG, JPEG hoặc WebP tối đa 1 MB.';
      event.target.value = '';
      return;
    }
    busy.value = true;
    try {
      bookForm.value.AnhBia = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Không đọc được ảnh bìa.'));
        reader.readAsDataURL(file);
      });
      error.value = '';
    } catch (e) {
      error.value = e.message;
    } finally {
      busy.value = false;
    }
  }
  async function saveReaderLock() {
    busy.value = true;
    try {
      await api('/admin/readers/' + selected.value._id + '/lock', {
        method: 'PATCH',
        body: lockForm.value,
      });
      modal.value = '';
      notify(
        lockForm.value.locked ? 'Đã khóa tài khoản độc giả.' : 'Đã mở khóa tài khoản độc giả.',
      );
      await loadAccount();
    } catch (e) {
      error.value = e.message;
    } finally {
      busy.value = false;
    }
  }
  const categories = computed(() => ['Tất cả', ...new Set(books.value.map((b) => b.TheLoai))]);
  const norm = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase();
  const filtered = computed(() =>
    books.value.filter(
      (b) =>
        (category.value === 'Tất cả' || b.TheLoai === category.value) &&
        norm(b.TenSach + ' ' + b.NguonGocTacGia + ' ' + b.TheLoai).includes(norm(query.value)),
    ),
  );
  const isStaff = computed(() => user.value && ['Admin', 'Librarian'].includes(user.value.role));
  const labels = {
    ChoDuyet: 'Chờ duyệt',
    ChoNhan: 'Đã duyệt · Chờ nhận sách',
    DangMuon: 'Đang mượn',
    DaTra: 'Đã trả',
    TuChoi: 'Từ chối',
    DaHuy: 'Đã hủy',
  };
  const money = (v) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v || 0);
  const date = (v) => (v ? new Date(v).toLocaleDateString('vi-VN') : '—');
  function notify(text) {
    notice.value = text;
    setTimeout(() => (notice.value = ''), 4500);
  }
  function navigate(p) {
    if ((p === 'admin') !== adminPortal) return;
    page.value = p;
    history.pushState({}, '', p === 'admin' ? '/admin' : p === 'home' ? '/' : '/' + p);
    error.value = '';
    if (p === 'loans' || p === 'admin') loadAccount();
    if (p === 'recommendations') loadRecommendations();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function onPopState() {
    const target = location.pathname.split('/')[1];
    if ((target === 'admin') !== adminPortal) {
      location.reload();
      return;
    }
    page.value = ['admin', 'catalog', 'loans', 'recommendations'].includes(target)
      ? target
      : 'home';
    if (['loans', 'admin'].includes(page.value)) loadAccount();
    if (page.value === 'recommendations') loadRecommendations();
  }
  window.addEventListener('popstate', onPopState);
  onUnmounted(() => window.removeEventListener('popstate', onPopState));
  async function load() {
    loading.value = true;
    try {
      books.value = await api('/books');
      publishers.value = await api('/publishers');
    } catch (e) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }
  async function loadAccount() {
    if (!user.value) return;
    try {
      [loans.value, reports.value] = await Promise.all([api('/loans'), api('/reports')]);
      if (isStaff.value) {
        [stats.value, readers.value] = await Promise.all([
          api('/admin/stats'),
          api('/admin/readers'),
        ]);
      }
    } catch (e) {
      error.value = e.message;
    }
  }
  async function loadRecommendations() {
    if (!user.value || isStaff.value) return;
    try {
      const r = await api('/recommendations');
      recommendations.value = r.books;
      personalized.value = r.personalized;
    } catch (e) {
      error.value = e.message;
    }
  }
  async function authenticate() {
    busy.value = true;
    try {
      const r = await api(
        '/auth/' + (authTab.value === 'register' && !adminPortal ? 'register' : 'login'),
        {
          method: 'POST',
          body:
            authTab.value === 'register' && !adminPortal
              ? registerForm.value
              : { ...loginForm.value, portal: page.value === 'admin' ? 'admin' : 'reader' },
        },
      );
      localStorage.setItem(sessionKey + 'token', r.token);
      localStorage.setItem(sessionKey + 'user', JSON.stringify(r.user));
      user.value = r.user;
      modal.value = '';
      notify('Đăng nhập thành công');
      await loadAccount();
    } catch (e) {
      error.value = e.message;
    } finally {
      busy.value = false;
    }
  }
  function logout() {
    localStorage.removeItem(sessionKey + 'token');
    localStorage.removeItem(sessionKey + 'user');
    user.value = null;
    loans.value = [];
    reports.value = [];
    stats.value = {};
    readers.value = [];
    modal.value = '';
    navigate(adminPortal ? 'admin' : 'home');
  }
  function openAuth() {
    authTab.value = 'login';
    modal.value = 'auth';
    error.value = '';
  }
  function detail(b) {
    selected.value = b;
    modal.value = 'detail';
    error.value = '';
  }
  async function borrow() {
    if (!user.value) {
      openAuth();
      return;
    }
    busy.value = true;
    try {
      await api('/loans', {
        method: 'POST',
        body: { bookId: selected.value._id, ...borrowForm.value },
      });
      modal.value = '';
      notify('Đã gửi yêu cầu mượn. Vui lòng chờ thủ thư duyệt.');
      await loadAccount();
    } catch (e) {
      error.value = e.message;
    } finally {
      busy.value = false;
    }
  }
  async function loanAction(l, action, extra = {}) {
    busy.value = true;
    try {
      await api('/loans/' + l._id, { method: 'PATCH', body: { action, ...extra } });
      modal.value = '';
      notify('Đã cập nhật phiếu mượn.');
      await Promise.all([load(), loadAccount()]);
    } catch (e) {
      error.value = e.message;
    } finally {
      busy.value = false;
    }
  }
  function editBook(b) {
    bookForm.value = b
      ? { ...b, DanhMuc: b.DanhMuc || 'Sách tham khảo', MaNXB: b.MaNXB?._id }
      : {
          MaSach: '',
          TenSach: '',
          NguonGocTacGia: '',
          TheLoai: 'Công nghệ',
          DanhMuc: 'Sách tham khảo',
          AnhBia: '',
          DonGia: 0,
          SoQuyen: 1,
          NamXuatBan: new Date().getFullYear(),
          MaNXB: publishers.value[0]?._id,
          MoTa: '',
          MauBia: '#31556b',
        };
    modal.value = 'book';
    error.value = '';
  }
  async function saveBook() {
    busy.value = true;
    try {
      await api('/books' + (bookForm.value._id ? '/' + bookForm.value._id : ''), {
        method: bookForm.value._id ? 'PUT' : 'POST',
        body: bookForm.value,
      });
      modal.value = '';
      notify('Đã lưu sách.');
      await Promise.all([load(), loadAccount()]);
    } catch (e) {
      error.value = e.message;
    } finally {
      busy.value = false;
    }
  }
  async function savePublisher() {
    busy.value = true;
    try {
      await api('/publishers', { method: 'POST', body: publisherForm.value });
      modal.value = '';
      publisherForm.value = { MaNXB: '', TenNXB: '', DiaChi: '' };
      await load();
      notify('Đã thêm nhà xuất bản.');
    } catch (e) {
      error.value = e.message;
    } finally {
      busy.value = false;
    }
  }
  async function sendReport() {
    if (!user.value) {
      openAuth();
      return;
    }
    busy.value = true;
    try {
      await api('/reports', {
        method: 'POST',
        body: { bookId: selected.value._id, content: reportContent.value },
      });
      reportContent.value = '';
      modal.value = '';
      notify('Đã gửi phản hồi về sách.');
      await loadAccount();
    } catch (e) {
      error.value = e.message;
    } finally {
      busy.value = false;
    }
  }
  async function updateReport(report) {
    busy.value = true;
    try {
      await api('/reports/' + report._id, {
        method: 'PATCH',
        body: { status: report.TrangThai, response: report.PhanHoi },
      });
      notify('Đã lưu kết quả xử lý.');
      await loadAccount();
    } catch (e) {
      error.value = e.message;
    } finally {
      busy.value = false;
    }
  }
  async function ask(text) {
    const q = text || question.value;
    if (!q.trim() || chatBusy.value) return;
    chatOpen.value = true;
    question.value = '';
    chat.value.push({ role: 'user', text: q });
    chatBusy.value = true;
    try {
      const r = await api('/ai/search', { method: 'POST', body: { question: q } });
      chat.value.push({ role: 'assistant', text: r.answer, results: r.results });
    } catch (e) {
      chat.value.push({ role: 'assistant', text: e.message });
    } finally {
      chatBusy.value = false;
    }
  }
  onMounted(async () => {
    if (localStorage.getItem(sessionKey + 'token')) {
      try {
        const profile = await api('/auth/me');
        if ((profile.role !== 'Reader') === adminPortal) user.value = profile;
        else logout();
      } catch {
        logout();
      }
    }
    await load();
    if (['admin', 'loans'].includes(page.value)) await loadAccount();
    if (page.value === 'recommendations') await loadRecommendations();
  });
  watch(user, () => {
    if (page.value === 'recommendations') loadRecommendations();
  });

  return {
    today,
    returnDateLimit,
    borrowForm,
    openBorrow,
    pickupCode,
    lockForm,
    saveReaderLock,
    genreOptions,
    catalogOptions,
    uploadCover,
    adminPortal,
    reports,
    reportContent,
    sendReport,
    updateReport,
    page,
    user,
    books,
    category,
    query,
    error,
    notice,
    loading,
    loans,
    stats,
    readers,
    publishers,
    recommendations,
    personalized,
    modal,
    selected,
    busy,
    adminTab,
    authTab,
    chatOpen,
    question,
    chat,
    chatBusy,
    loginForm,
    registerForm,
    bookForm,
    publisherForm,
    returnForm,
    categories,
    filtered,
    isStaff,
    labels,
    money,
    date,
    notify,
    navigate,
    load,
    loadAccount,
    loadRecommendations,
    authenticate,
    logout,
    openAuth,
    detail,
    borrow,
    loanAction,
    editBook,
    saveBook,
    savePublisher,
    ask,
  };
}

export function useLibraryContext() {
  const library = inject(libraryKey);
  if (!library) throw new Error('Library context is missing.');
  return library;
}
