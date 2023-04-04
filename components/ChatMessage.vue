<template>
  <div v-if="value" class="w-full">
    {{ value.username }} [{{ value.message._getType() }}]
    <div v-show="rendered" v-html="rendered" />
  </div>
  <div v-else class="w-full">
    {{ error }}
  </div>
</template>

<script setup lang="ts">
import { Ref } from 'vue';
import { UiChatMessage } from '~/composables/beans/Chats';

const { $renderMarkdown } = useNuxtApp();
const { value, error } = defineProps<{ value: UiChatMessage; error?: unknown }>();
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
