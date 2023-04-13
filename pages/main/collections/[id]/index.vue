<template>
  <div>
    Collection {{ route.path }}
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
navigateTo(`${route.path}/indexes`);
</script>
