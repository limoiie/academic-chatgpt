<template>
  <NuxtPage />
</template>

<script setup lang="ts">
const route = useRoute();
navigateTo(route.path + '/sessions');
</script>
