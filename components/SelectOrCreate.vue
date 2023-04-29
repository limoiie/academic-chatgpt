<template>
  <div class="flex flex-col">
    <div class="flex flex-row">
      <a-drawer
        :visible="creating"
        @update:visible="(visible) => emits('update:creating', visible)"
        :title="title"
        :width="480"
      >
        <slot name="createForm" />
        <template #extra>
          <a-button @click="emits('create')" type="primary">Create</a-button>
        </template>
      </a-drawer>
      <a-drawer
        :visible="previewing"
        @update:visible="(visible) => emits('update:previewing', visible)"
        title="Preview"
        :width="480"
      >
        <slot name="preview">
          {{ JSON.stringify(value) }}
        </slot>
      </a-drawer>

      <a-select
        ref="select"
        :value="value"
        @update:value="(newValue) => emits('update:value', newValue)"
        class="flex-1"
        :options="options"
        :field-names="{ label: 'label', value: 'value', options: 'options' }"
        :loading="loading"
      />

      <a-space class="ml-2">
        <a-button :disabled="loading" shape="circle" @click="emits('update:creating', true)">
          <template #icon>
            <PlusOutlined />
          </template>
        </a-button>
        <a-button :disabled="loading" shape="circle" @click="emits('update:previewing', true)">
          <template #icon>
            <FundViewOutlined />
          </template>
        </a-button>
      </a-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FundViewOutlined, PlusOutlined } from '@ant-design/icons-vue';
import { SelectProps } from 'ant-design-vue';

const { value, options, title, loading, previewing, creating } = defineProps<{
  value: any | undefined;
  options: SelectProps['options'];
  title: string;
  loading: boolean;
  previewing?: boolean;
  creating: boolean;
}>();
const emits = defineEmits(['update:value', 'update:creating', 'update:previewing', 'create']);
</script>
