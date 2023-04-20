<template>
  <div>
    <a-button v-if="IN_TAURI" class="ant-btn-with-icon" :loading="loading" @click="openFileSelectionDialogInTauri">
      <slot name="icon">
        <UploadOutlined />
      </slot>
      <slot name="text"> Upload</slot>
    </a-button>
    <a-upload
      v-else
      :before-upload="onOpenFileSelectorDialogInBrowser"
      :multiple="options?.multiple || false"
      :directory="options?.directory || false"
      :show-upload-list="false"
    >
      <a-button class="ant-btn-with-icon" :loading="loading">
        <slot name="icon">
          <UploadOutlined />
        </slot>
        <slot name="text"> Upload</slot>
      </a-button>
    </a-upload>
  </div>
</template>

<script setup lang="ts">
import { UploadOutlined } from '@ant-design/icons-vue';
import { open, OpenDialogOptions } from '@tauri-apps/api/dialog';

const props = defineProps<{
  options: OpenDialogOptions;
  loading?: boolean | undefined;
}>();
const emits = defineEmits(['select']);
const { options, loading = false } = toRefs(props);

function onOpenFileSelectorDialogInBrowser(file: File, fileList: File[]) {
  // we want to emit the fileList only once while this callback will be called for each file
  if (file == fileList[0]) {
    emits('select', fileList);
  }
  return false;
}

async function openFileSelectionDialogInTauri() {
  const selected = await open(options.value);
  const selectedList = !selected ? selected : Array.isArray(selected) ? selected : [selected];
  emits('select', selectedList);
}
</script>
