<template>
  <div class="w-full h-full flex items-center">
    <a-spin class="flex m-auto!" size="large" />
  </div>
</template>

<script setup lang="ts">
import { useDefaultCompleteStore } from '~/store/defaultComplete';
import { useDefaultVectorDbStore } from '~/store/defaultVectorDb';

const defaultCompleteStore = useDefaultCompleteStore();
const defaultVectorDbStore = useDefaultVectorDbStore();

if ((await defaultCompleteStore.load()) && (await defaultVectorDbStore.load())) {
  navigateTo('/main');
} else {
  navigateTo('/presets');
}
</script>
