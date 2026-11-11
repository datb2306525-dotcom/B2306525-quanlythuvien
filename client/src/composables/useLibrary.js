import { ref, computed, onMounted, onUnmounted, watch, inject } from 'vue';
import { defaultGenres, genresOf, genreLabel, readerCategories, filterCatalog } from '../genres';
import { api } from '../api';

export const libraryKey = Symbol('library');

// Shared state and API actions for the reader and staff views.
export function useLibrary() {
  const adminPortal = location.pathname.split('/')[1] === 'admin';
  const sessionKey = adminPortal ? 'athena-admin-' : 'athena-';
  const initialPage = location.pathname.split('/')[1];
  const page = ref(
      ['admin', 'catalog', 'loans', 'recommendations', 'account', 'requests'].includes(initialPage)
        ? initialPage
        : 'home',
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
  const profileForm = ref({}),
    profileLoading = ref(false),
    profileError = ref('');
  const oauthProviders = ref({ google: false, facebook: false });
  const modal = ref(''),
    selected = ref(null),
    busy = ref(false),
    adminTab = ref('overview'),
    authTab = ref('login'),
    chatOpen = ref(false),
    question = ref(''),
    chat = ref([]),
    chatBusy = ref(false);
  const chatConfig = ref({ provider: 'catalog', configured: false, requiresConsent: false });
  const consentStorageKey = sessionKey + 'gemini-consent-v1';
  let sessionConsent = false;
  try {
    sessionConsent = sessionStorage.getItem(consentStorageKey) === 'true';
  } catch {
    // If storage is disabled, keep consent in memory for this page only.
  }
  const externalAIConsent = ref(sessionConsent);
  const chatConfigLoaded = ref(false);
  watch(
    externalAIConsent,
    () => {
      try {
        if (externalAIConsent.value) sessionStorage.setItem(consentStorageKey, 'true');
        else sessionStorage.removeItem(consentStorageKey);
      } catch {
        // The current page can still remember the explicit choice.
      }
      // Each consent period starts fresh; earlier local messages are not exported later.
      for (const message of chat.value) message.shareWithGoogle = false;
    },
    { flush: 'sync' },
  );

  async function loadChatConfig() {
    try {
      chatConfig.value = await api('/ai/config');
      chatConfigLoaded.value = true;
    } catch {
      // No consent flag is sent when configuration cannot be checked.
      chatConfigLoaded.value = false;
    }
  }
  watch(chatOpen, (open) => {
    if (open) loadChatConfig();
  });
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
    ...new Set([...defaultGenres, ...books.value.flatMap((b) => genresOf(b.TheLoai))]),
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
  const categories = readerCategories;
  const norm = (s) =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase();
  const filtered = computed(() => filterCatalog(books.value, category.value, query.value));
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
    if (p === 'account') loadProfile();
    if (p === 'recommendations') loadRecommendations();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function onPopState() {
    const target = location.pathname.split('/')[1];
    if ((target === 'admin') !== adminPortal) {
      location.reload();
      return;
    }
    page.value = ['admin', 'catalog', 'loans', 'recommendations', 'account', 'requests'].includes(
      target,
    )
      ? target
      : 'home';
    if (['loans', 'admin'].includes(page.value)) loadAccount();
    if (page.value === 'account') loadProfile();
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
        authTab.value === 'social' && !adminPortal
          ? '/auth/oauth/complete'
          : '/auth/' + (authTab.value === 'register' && !adminPortal ? 'register' : 'login'),
        {
          method: 'POST',
          body:
            ['register', 'social'].includes(authTab.value) && !adminPortal
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
      if (page.value === 'account') await loadProfile();
    } catch (e) {
      error.value = e.message;
    } finally {
      busy.value = false;
    }
  }
  function socialLogin(provider) {
    if (adminPortal || provider !== 'google' || !oauthProviders.value.google) return;
    location.assign('/api/auth/oauth/' + provider + '/start');
  }
  async function socialCallback() {
    if (adminPortal || location.pathname !== '/auth/callback') return;
    const params = new URLSearchParams(location.hash.slice(1));
    history.replaceState({}, '', '/');
    page.value = 'home';
    modal.value = 'auth';
    if (params.has('oauth_error')) {
      error.value = params.get('oauth_error');
      return;
    }
    if (!params.get('oauth_code')) {
      error.value = 'Thiếu mã đăng nhập. Vui lòng thử lại.';
      return;
    }
    busy.value = true;
    try {
      const result = await api('/auth/oauth/exchange', {
        method: 'POST',
        body: { code: params.get('oauth_code') },
      });
      if (result.profileRequired) {
        const parts = result.profile.name.trim().split(/\s+/);
        registerForm.value = {
          HoLot: parts.length > 1 ? parts.slice(0, -1).join(' ') : '',
          Ten: parts.at(-1) || '',
          Email: result.profile.email,
          Password: '',
          NgaySinh: '',
          Phai: 'Khác',
          DiaChi: '',
          DienThoai: '',
          LoaiDocGia: 'Sinh viên',
        };
        authTab.value = 'social';
      } else {
        localStorage.setItem('athena-token', result.token);
        localStorage.setItem('athena-user', JSON.stringify(result.user));
        user.value = result.user;
        modal.value = '';
        notify('Đăng nhập thành công');
      }
    } catch (e) {
      error.value = e.message;
    } finally {
      busy.value = false;
    }
  }
  function requestLogout() {
    error.value = '';
    modal.value = 'logout';
  }
  async function loadProfile() {
    if (!user.value || isStaff.value) return;
    profileLoading.value = true;
    profileError.value = '';
    try {
      const profile = await api('/auth/profile');
      profileForm.value = {
        ...profile,
        NgaySinh: profile.NgaySinh ? profile.NgaySinh.slice(0, 10) : '',
      };
    } catch (e) {
      profileError.value = e.message;
    } finally {
      profileLoading.value = false;
    }
  }
  async function saveProfile() {
    busy.value = true;
    profileError.value = '';
    try {
      const result = await api('/auth/profile', { method: 'PATCH', body: profileForm.value });
      profileForm.value = {
        ...result.profile,
        NgaySinh: result.profile.NgaySinh?.slice(0, 10) || '',
      };
      user.value = result.user;
      localStorage.setItem('athena-user', JSON.stringify(result.user));
      notify('Đã cập nhật thông tin tài khoản.');
    } catch (e) {
      profileError.value = e.message;
    } finally {
      busy.value = false;
    }
  }
  function logout() {
    externalAIConsent.value = false;
    chat.value = [];
    localStorage.removeItem(sessionKey + 'token');
    localStorage.removeItem(sessionKey + 'user');
    user.value = null;
    profileForm.value = {};
    profileError.value = '';
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
      ? {
          ...b,
          TheLoai: [...genresOf(b.TheLoai)],
          DanhMuc: b.DanhMuc || 'Sách tham khảo',
          MaNXB: b.MaNXB?._id,
        }
      : {
          MaSach: '',
          TenSach: '',
          NguonGocTacGia: '',
          TheLoai: [],
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
    if (!bookForm.value.TheLoai?.length) {
      error.value = 'Chọn ít nhất một thể loại cho sách.';
      return;
    }
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
    const q = (text || question.value).trim();
    if (!q.trim() || chatBusy.value) return;
    if (q.length > 1000) return;
    chatBusy.value = true;
    if (!chatConfigLoaded.value) await loadChatConfig();
    const shareWithGoogle =
      chatConfigLoaded.value &&
      chatConfig.value.provider === 'gemini' &&
      externalAIConsent.value === true;
    const history = chat.value
      .filter((message) => !message.failed && (!shareWithGoogle || message.shareWithGoogle))
      .slice(-6)
      .map((message) => ({
        role: message.role,
        text: message.text.slice(0, 1000),
        bookIds: (message.results || []).map((result) => result.bookId),
      }));
    chatOpen.value = true;
    question.value = '';
    chat.value.push({ role: 'user', text: q, shareWithGoogle });
    chatBusy.value = true;
    try {
      const r = await api('/ai/search', {
        method: 'POST',
        body: { question: q, history, externalAIConsent: shareWithGoogle },
      });
      chat.value.push({
        role: 'assistant',
        text: r.answer,
        results: r.results,
        external: r.external || [],
        mode: r.mode,
        aiUnavailable: r.aiUnavailable,
        aiError: r.aiError,
        consentRequired: r.consentRequired,
        shareWithGoogle,
        stockCheckedAt: r.stockCheckedAt,
      });
    } catch (e) {
      chat.value.push({ role: 'assistant', text: e.message, failed: true });
      question.value = q;
    } finally {
      chatBusy.value = false;
    }
  }
  onMounted(async () => {
    if (!adminPortal) {
      try {
        oauthProviders.value = await api('/auth/oauth/providers');
      } catch {
        /* Email login remains available. */
      }
      await socialCallback();
    }
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
    if (page.value === 'account') await loadProfile();
    if (page.value === 'recommendations') await loadRecommendations();
  });
  watch(user, () => {
    if (page.value === 'recommendations') loadRecommendations();
  });

  return {
    profileForm,
    profileLoading,
    profileError,
    loadProfile,
    saveProfile,
    requestLogout,
    oauthProviders,
    socialLogin,
    today,
    returnDateLimit,
    borrowForm,
    openBorrow,
    pickupCode,
    lockForm,
    saveReaderLock,
    genreOptions,
    genreLabel,
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
    chatConfig,
    externalAIConsent,
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
