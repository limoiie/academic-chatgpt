<template>
  <div class="w-full h-full flex">
    <div class="m-auto flex flex-col">
      <div v-if="loading">
        <a-spin class="m-auto!" :spinning="loading" />
        <div>Loading index profiles...</div>
      </div>
      <div v-else-if="errorMessage">
        <a-result status="error">
          <template #title>Failed to create a new collection</template>
          <template #subTitle>{{ errorMessage }}</template>
        </a-result>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue';
import { useCollectionStore } from '~/store/collections';

const loading = ref<boolean>(false);
const errorMessage = ref<string>('');

const route = useRoute();
const collectionStore = useCollectionStore();
const collectionId = parseInt(route.params['id'] as string);

await Promise.resolve((loading.value = true))
  .then(() => collectionStore.load())
  .then(async () => {
    const active = await collectionStore.getActiveIndexProfileByCollectionId(collectionId);
    if (active) {
      navigateTo(`${route.path}/${active.indexId}`);
    } else {
      navigateTo(route.path.replace(/\/indexes/, '/manage'));
    }
  })
  .catch((error) => {
    message.error(errToString(error));
  })
  .finally(() => (loading.value = false));
</script>
