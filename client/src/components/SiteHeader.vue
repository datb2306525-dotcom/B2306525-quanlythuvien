<script setup>
import { useLibraryContext } from '../composables/useLibrary';
const { page, user, loans, recommendations, navigate, logout, openAuth } = useLibraryContext();
</script>

<template>
  <div class="utility">
    <div class="container-wide">
      <span><i class="bi bi-mortarboard"></i> Không gian tri thức dành cho mọi người</span
      ><span
        ><i class="bi bi-envelope"></i> library@athena.edu.vn <span class="utility-divider">|</span>
        <i class="bi bi-clock"></i> T2 – T7: 07:30 – 20:00</span
      >
    </div>
  </div>
  <header class="main-header">
    <div class="container-wide nav-wrap">
      <a
        href="/"
        class="brand"
        @click.prevent="navigate('home')"
        ><span class="brand-icon"><i class="bi bi-book"></i></span
        ><span>ATHENA<small>LIBRARY & KNOWLEDGE</small></span></a
      >
      <nav aria-label="Điều hướng chính">
        <a
          href="/"
          :class="{ active: page === 'home' }"
          @click.prevent="navigate('home')"
          >Trang chủ</a
        ><a
          href="/catalog"
          :class="{ active: page === 'catalog' }"
          @click.prevent="navigate('catalog')"
          >Khám phá sách</a
        ><a
          href="/recommendations"
          :class="{ active: page === 'recommendations' }"
          @click.prevent="navigate('recommendations')"
          >Dành cho bạn <span class="tiny-new">MỚI</span></a
        ><a
          href="/loans"
          :class="{ active: page === 'loans' }"
          @click.prevent="navigate('loans')"
          >Sách của tôi</a
        >
      </nav>
      <div class="nav-actions">
        <button
          v-if="!user"
          class="btn btn-navy"
          @click="openAuth"
        >
          Đăng nhập <i class="bi bi-arrow-up-right"></i></button
        ><button
          v-else
          class="profile"
          @click="logout"
          title="Đăng xuất"
        >
          <span>{{ user.name.charAt(0) }}</span
          >{{ user.name }} <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    </div>
  </header>
</template>
