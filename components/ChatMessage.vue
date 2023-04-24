<template>
  <div class="w-[calc(100%-8rem)] pt-4">
    <div class="w-full mb-4 flex flex-row gap-4">
      <div class="w-14">  <!-- 14 == 3.5em == 56px -->
        <slot name="avatar" :username="briefName(value.username)">
          {{ value.username }}
        </slot>
      </div>
      <div class="w-[calc(100%-56px)]">  <!-- 56px is the width of avator -->
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
import { briefName } from '~/utils/strings';

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
pre
  code
    border-radius: 4px
</style>
