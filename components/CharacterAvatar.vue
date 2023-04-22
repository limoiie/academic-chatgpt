<template>
  <div class="flex items-center justify-center">
    {{ value }}
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  value: string;
}>();
</script>
