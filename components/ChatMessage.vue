<template>
  <div v-if="value" class="w-full pt-4 px-16">
    <div class="mb-2">{{ value.username }} [{{ value.message._getType() }}]</div>
    <div v-show="rendered" v-html="rendered" />
    <div v-if="answering"><a-spin size="small" /></div>
  </div>
  <div v-else class="w-full">
    {{ error }}
  </div>
</template>

<script setup lang="ts">
import { Ref } from 'vue';
import { UiChatMessage } from '~/composables/beans/Chats';

const { $renderMarkdown } = useNuxtApp();
const {
  value,
  error,
  answering = false,
} = defineProps<{ value: UiChatMessage; error?: unknown; answering?: boolean }>();
const rendered: Ref<string | undefined> = ref(undefined);
watch(
  () => value.message.text,
  async (text) => {
    rendered.value = await $renderMarkdown('', text);
  },
  {
    immediate: true,
  },
);
</script>

<style scoped></style>
