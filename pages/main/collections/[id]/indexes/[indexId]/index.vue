<template>
  <div class="w-full h-full flex">
    <div v-if="isLoading" class="m-auto flex flex-col">
      <div class="flex flex-col items-center">
        <a-spin class="m-auto!" :spinning="isLoading" />
        <div>Loading sessions...</div>
      </div>
    </div>
    <ChatSessions v-else-if="index" :index="index" />
  </div>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue';
import ChatSessions from '~/components/ChatSessions.vue';
import { CollectionIndexWithAll } from '~/plugins/tauri/bindings';
import { useCollectionsStore } from '~/store/collections';

const isLoading = ref<boolean>(false);

const route = useRoute();
const collectionId = parseInt(route.params['id'] as string);
const indexId = parseInt(route.params['indexId'] as string);

const collectionStore = useCollectionsStore();
const index: CollectionIndexWithAll | null = await Promise.resolve((isLoading.value = true))
  .then(() => collectionStore.load())
  .then(async () => {
    const index = collectionStore.getCollectionIndexById(collectionId, indexId);
    if (!index) {
      throw new Error(`No such index ${indexId} for collection ${collectionId}`);
    }
    return index;
  })
  .catch((e) => {
    message.error(`Failed to load index profile: ${errToString(e)}, jump to manage page.`);
    navigateTo(`/main/collections/${collectionId}/manage`);
    return null;
  })
  .finally(() => (isLoading.value = false));
</script>
