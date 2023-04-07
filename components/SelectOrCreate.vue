<template>
  <div class="flex flex-col">
    <div class="flex flex-row">
      <a-modal :visible="creating" @update:visible="updateCreating" @ok="emits('ok')" ok-text="Create" :title="title">
        <slot name="createForm" />
      </a-modal>

      <a-select
        ref="select"
        :value="value"
        @update:value="updateValue"
        class="flex-1"
        :options="options"
        :field-names="{ label: 'label', value: 'value', options: 'options' }"
        :loading="loading"
      />
      <a-button class="mx-2" :disabled="loading" shape="circle" @click="updateCreating(true)">
        <template #icon>
          <PlusCircleOutlined />
        </template>
      </a-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PlusCircleOutlined } from '@ant-design/icons-vue';
import { SelectProps } from 'ant-design-vue';

const { value, options, title, loading, creating } = defineProps<{
  value: any | undefined;
  options: SelectProps['options'];
  title: string;
  loading: boolean;
  creating: boolean;
}>();
const emits = defineEmits(['update:value', 'update:creating', 'ok']);

function updateValue(newValue: any) {
  emits('update:value', newValue);
}

function updateCreating(newState: boolean) {
  emits('update:creating', newState);
}
</script>
