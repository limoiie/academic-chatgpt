<template>
  <a-space id="trace-bar"  class="w-full" direction="vertical">
    <a-progress :percent="percentage" status="normal" />
    <a-space class="flex flex-row items-baseline!">
      <a-button :type="showDetails == 1 ? 'primary' : 'dashed'" size="small" shape="circle" @click="toggleShowDetails">
        <template #icon>
          <DownCircleOutlined v-if="!showDetails" />
          <UpCircleOutlined v-else />
        </template>
      </a-button>
      <div class="whitespace-nowrap overflow-scroll">{{ title }}</div>
    </a-space>

    <a-collapse v-model:activeKey="showDetails" ghost>
      <template #expandIcon></template>
      <a-collapse-panel :key="1">
        <LogConsole class="border-0 max-h-32 overflow-scroll" :logs="logs" />
      </a-collapse-panel>
    </a-collapse>
  </a-space>
</template>

<script setup lang="ts">
import { DownCircleOutlined, UpCircleOutlined } from '@ant-design/icons-vue';
import { TracerStatus } from '~/utils/tracer';

const { tracerStatus } = defineProps<{ tracerStatus: TracerStatus }>();
const { logs, percentage, title } = tracerStatus;

// Show details or not, 0 = false, 1 = true
const showDetails = ref<number>(0);

function toggleShowDetails() {
  showDetails.value = 1 - showDetails.value;
}
</script>

<style lang="sass">
#trace-bar
  .ant-collapse
    .ant-collapse-item
      .ant-collapse-header
        padding: 0

  .ant-collapse-content
    .ant-collapse-content-box
      padding: 0 !important
</style>
