<template>
  <div class="w-full pt-4 px-16">
    <div class="w-full mb-4 flex flex-row gap-4">
      <slot name="avatar" :username="value.username">
        {{ value.username }}
      </slot>
      <div class="w-full">
        <div v-show="rendered" v-html="rendered" />
        <div v-if="answering" class="flex flex-row items-baseline gap-3">
          <a-spin size="small" />
          <a-button shape="circle" size="small" type="primary" @click="stopAnswering">
            <template #icon>
              <PauseCircleOutlined />
            </template>
          </a-button>
        </div>
      </div>
    </div>

    <a-alert v-if="value.error" type="error" show-icon>
      <template #description>
        {{ value.error }}
      </template>
    </a-alert>
  </div>
</template>

<script setup lang="ts">
import { PauseCircleOutlined } from '@ant-design/icons-vue';
import { Ref } from 'vue';
import { UiChatMessage } from '~/composables/beans/Chats';

// noinspection JSUnusedGlobalSymbols
const { $renderMarkdown } = useNuxtApp();
const emits = defineEmits(['stopAnswering']);
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

function stopAnswering() {
  emits('stopAnswering', true);
}
</script>

<style lang="sass">
code
  border-radius: 4px
</style>
