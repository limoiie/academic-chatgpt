<template>
  <div class="w-[calc(100%-8rem)] pt-4">
    <div class="w-full mb-4 flex flex-row">
      <div class="w-14">
        <!-- 14 == 3.5em == 56px -->
        <slot name="avatar" :username="briefName(value.username)">
          {{ value.username }}
        </slot>
      </div>
      <div class="w-[calc(100%-56px)] flex flex-col gap-4">
        <!-- 56px is the width of avatar -->
        <div v-show="rendered" v-html="rendered" />
        <div v-if="answering" class="flex flex-row items-baseline gap-3">
          <a-spin size="small" />
          <a-button shape="circle" size="small" type="primary" @click="stopAnswering">
            <template #icon>
              <PauseCircleOutlined />
            </template>
          </a-button>
        </div>
        <a-collapse :bordered="false">
          <a-collapse-panel v-for="doc of value.meta?.sourceDocuments || []" header="Reference">
            <!--suppress TypeScriptUnresolvedReference -->
            <p class="whitespace-pre-wrap">{{ doc.pageContent }}</p>
          </a-collapse-panel>
        </a-collapse>
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
  useThrottleFn(
    async (text) => {
      rendered.value = await $renderMarkdown('', text);
    },
    80,
    true,
    false,
  ),
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
