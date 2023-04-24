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
import { useCollectionStore } from '~/store/collections';

const isLoading = ref<boolean>(false);
const errorMessage = ref<string>('');

const collectionStore = useCollectionStore();
const { activeCollectionId } = storeToRefs(collectionStore);

await Promise.resolve((isLoading.value = true))
  .then(() => collectionStore.load())
  .then(async () => {
    navigateToDefaultCollection();
  })
  .catch((error) => {
    errorMessage.value = errToString(error);
  })
  .finally(() => (isLoading.value = false));

function navigateToDefaultCollection() {
  const collectionId = activeCollectionId.value;
  if (collectionId) {
    navigateTo(`/main/collections/${collectionId}`);
  }
}

function navigateToCreatePage() {
  navigateTo('/main/collections/create');
}
</script>
