<template>
  <div class="w-full h-full flex items-center justify-center">
    <div v-if="isLoading" class="flex flex-col">
      <a-spin class="m-auto!" :spinning="isLoading" />
      <div>Loading sessions...</div>
    </div>
    <!--suppress TypeScriptUnresolvedReference -->
    <ChatSessions v-else-if="data" :index="data.index" :collection="data.collection" />
    <a-result v-else-if="errorMessage" status="error">
      <template #title>Failed to load index #{{ indexId }} of collection #{{ collectionId }}</template>
      <template #subTitle>{{ errorMessage }}</template>
      <template #extra>
        <a-button type="primary" @click="navigateToManagePage">Go to Manage</a-button>
      </template>
    </a-result>
  </div>
</template>

<script setup lang="ts">
import { useAsyncData } from '#app';
import ChatSessions from '~/components/ChatSessions.vue';
import { useCollectionStore } from '~/store/collections';

const isLoading = ref<boolean>(false);
const errorMessage = ref<string>('');

const route = useRoute();
const collectionId = parseInt(route.params['id'] as string);
const indexId = parseInt(route.params['indexId'] as string);

const collectionStore = useCollectionStore();
const { data, error } = useAsyncData(`indexDataOfCollection${collectionId}Index${indexId}`, async () => {
  return await Promise.resolve((isLoading.value = true))
    .then(() => collectionStore.load())
    .then(async () => {
      const collection = await collectionStore.getCollection(collectionId);
      const index = collectionStore.getCollectionIndexById(collectionId, indexId);
      if (!collection) {
        throw new Error(`No such collection ${collectionId}`);
      }
      if (!index) {
        throw new Error(`No such index ${indexId} for collection ${collectionId}`);
      }
      return { collection, index };
    })
    .finally(() => (isLoading.value = false));
});
watch(error, () => {
  errorMessage.value = error.value ? errToString(error.value) : '';
});

function navigateToManagePage() {
  navigateTo(`/main/collections/${collectionId}/manage`);
}
</script>
