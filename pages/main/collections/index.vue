<template>
  <div class="w-full h-full flex">
    <div class="m-auto flex flex-col">
      <div v-if="isLoading">
        <a-spin class="m-auto!" :spinning="isLoading" />
        <div>Prepare new collection...</div>
      </div>
      <div v-else-if="errorMessage">
        <a-result status="error">
          <template #title>Failed to create a new collection</template>
          <template #subTitle>{{ errorMessage }}</template>
        </a-result>
      </div>
      <div v-else>
        <a-empty>
          <template #description>
            <span> No collection yet </span>
          </template>
          <a-button type="primary" @click="navigateToCreatePage">Create Now</a-button>
        </a-empty>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { Collection } from '~/plugins/tauri/bindings';
import { useCollectionsStore } from '~/store/collections';

const isLoading = ref<boolean>(false);
const errorMessage = ref<string>('');

const collectionStore = useCollectionsStore();
const { collections } = storeToRefs(collectionStore);

await Promise.resolve((isLoading.value = true))
  .then(() => collectionStore.load())
  .then(async () => {
    navigate(collections.value);
  })
  .catch((error) => {
    errorMessage.value = errToString(error);
  })
  .finally(() => (isLoading.value = false));

function navigate(collections: Collection[]) {
  const collection = collections[0];
  if (collection) {
    navigateTo(`/main/collections/${collection.id}`);
  }
}

function navigateToCreatePage() {
  navigateTo('/main/collections/create');
}
</script>
