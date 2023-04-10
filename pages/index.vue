<template>
  <div class="w-full h-full flex items-center">
    <a-spin class="flex m-auto!" size="large" />
  </div>
</template>

<script setup lang="ts">
import { useDefaultAIStore } from '~/store/defaultAI';
import { useDefaultVectorDbStore } from '~/store/defaultVectorDb';

const defaultAIStore = useDefaultAIStore();
const defaultVectorDbStore = useDefaultVectorDbStore();

if ((await defaultAIStore.loadFromLocalStore()) && (await defaultVectorDbStore.loadFromLocalStore())) {
  navigateTo('/main');
} else {
  navigateTo('/default');
}
</script>
