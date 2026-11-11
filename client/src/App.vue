<script setup>
import { provide } from 'vue';
import { useLibrary, libraryKey } from './composables/useLibrary';
import SiteHeader from './components/SiteHeader.vue';
import SiteFooter from './components/SiteFooter.vue';
import ReportsPanel from './components/ReportsPanel.vue';
import LoansTable from './components/LoansTable.vue';
import AthenaChat from './components/AthenaChat.vue';
import LibraryDialogs from './components/LibraryDialogs.vue';
import AccountView from './views/AccountView.vue';
import HomeView from './views/HomeView.vue';
import AdminView from './views/AdminView.vue';
import LoansView from './views/LoansView.vue';
import RecommendationsView from './views/RecommendationsView.vue';
import BookRequestsView from './views/BookRequestsView.vue';

const library = useLibrary();
provide(libraryKey, library);
const { adminPortal, user, requestLogout, page, error, modal, notice, load } = library;
</script>

<template>
  <header
    v-if="adminPortal"
    class="main-header"
  >
    <div class="container-wide nav-wrap">
      <div class="brand">ATHENA <small>QUẢN TRỊ THƯ VIỆN</small></div>
      <button
        v-if="user"
        class="btn btn-outline-secondary"
        @click="requestLogout"
      >
        {{ user.name }} · Đăng xuất
      </button>
    </div>
  </header>
  <SiteHeader v-else />
  <div
    v-if="notice"
    class="toast-message"
    role="status"
  >
    <i class="bi bi-check-circle-fill"></i> {{ notice }}
  </div>
  <div
    v-if="error && !modal"
    class="container-wide alert alert-danger mt-3"
    role="alert"
  >
    {{ error }}
    <button
      class="btn btn-sm"
      @click="load"
    >
      Thử lại
    </button>
  </div>
  <HomeView v-if="page === 'home' || page === 'catalog'" />
  <AdminView v-else-if="page === 'admin'" />
  <AccountView v-else-if="page === 'account'" />
  <LoansView v-else-if="page === 'loans'" />
  <RecommendationsView v-else-if="page === 'recommendations'" />
  <BookRequestsView v-else-if="page === 'requests'" />
  <LoansTable v-if="!adminPortal" />
  <div
    v-if="!adminPortal && page === 'loans' && user"
    class="container-wide"
  >
    <ReportsPanel />
  </div>
  <SiteFooter v-if="!adminPortal" />
  <AthenaChat v-if="!adminPortal" />
  <LibraryDialogs />
</template>
