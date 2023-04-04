<template>
  <div class="h-full">
    <a-breadcrumb>
      <a-breadcrumb-item>Home</a-breadcrumb-item>
      <a-breadcrumb-item v-for="part of parts">{{ part }}</a-breadcrumb-item>
    </a-breadcrumb>

    <NuxtLoadingIndicator />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const parts = route.path.split('/');
</script>
