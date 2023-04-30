<template>
  <div v-if="index" class="whitespace-pre-wrap">
    {{ stringify(index) }}
  </div>
</template>

<script setup lang="ts">
import { stringify } from 'yaml';
import { CollectionIndexWithAll } from '~/plugins/tauri/bindings';

const props = defineProps<{
  index: CollectionIndexWithAll | undefined;
}>();

const { index } = toRefs(props);
</script>
