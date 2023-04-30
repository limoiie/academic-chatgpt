<template>
  <div class="w-full h-full flex">
    <div class="m-auto flex flex-col">
      <div v-if="loading">
        <a-spin class="m-auto!" :spinning="loading" />
        <div>Loading index profiles...</div>
      </div>
      <div v-else-if="errorMessage">
        <a-result status="error">
          <template #title>Failed to load indexes of collection#{{ collectionId }}</template>
          <template #subTitle>
            {{ errorMessage }} You may switch to
            <NuxtLink :href="managePageUrl">manage page</NuxtLink>
            .
          </template>
        </a-result>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCollectionStore } from '~/store/collections';

const loading = ref<boolean>(false);
const errorMessage = ref<string>('');

const route = useRoute();
const collectionId = parseInt(route.params['id'] as string);
const managePageUrl = route.path.replace(/\/indexes/, '/manage');

const collectionStore = useCollectionStore();

await Promise.resolve((loading.value = true))
  .then(() => collectionStore.load())
  .then(async () => {
    const activeIndex = await collectionStore.getActiveIndexByCollectionId(collectionId);
    if (!activeIndex) {
      return Promise.reject('No active index found!');
    }
    navigateTo(`${route.path}/${activeIndex.indexId}`);
  })
  .catch((error) => {
    errorMessage.value = errToString(error);
  })
  .finally(() => (loading.value = false));
</script>
