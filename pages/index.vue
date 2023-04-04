<script setup lang="ts">
const route = useRoute();
</script>

<template>
  <NuxtExampleLayout example="routing/pages">
    <NuxtLoadingIndicator />
    <NuxtPage />

    <template #nav>
      <nav class="flex align-center gap-4 p-4">
        <NuxtLink to="/" class="n-link-base"> Home </NuxtLink>
        <NuxtLink to="/main" class="n-link-base"> Main </NuxtLink>
        <NuxtLink to="/main/chat" class="n-link-base"> Main > Chat </NuxtLink>
      </nav>
    </template>
  </NuxtExampleLayout>
</template>
