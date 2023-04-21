<template>
  <div class="w-full h-full flex">
    <div v-if="isLoading" class="m-auto flex flex-col">
      <div class="flex flex-col items-center">
        <a-spin class="m-auto!" :spinning="isLoading" />
        <div>Loading sessions...</div>
      </div>
    </div>
    <ChatSessions v-else-if="index && collection" :index="index" :collection="collection" />
  </div>
</template>

<script setup lang="ts">
import { message } from "ant-design-vue";
import ChatSessions from "~/components/ChatSessions.vue";
import { useCollectionsStore } from "~/store/collections";

const isLoading = ref<boolean>(false);

const route = useRoute();
const collectionId = parseInt(route.params["id"] as string);
const indexId = parseInt(route.params["indexId"] as string);

const collectionStore = useCollectionsStore();
const { index, collection } = await Promise.resolve((isLoading.value = true))
  .then(() => collectionStore.load())
  .then(async () => {
    const collection = await collectionStore.getCollection(collectionId);
    if (!collection) {
      throw new Error(`No such collection ${collectionId}`);
    }
    const index = collectionStore.getCollectionIndexById(collectionId, indexId);
    if (!index) {
      throw new Error(`No such index ${indexId} for collection ${collectionId}`);
    }

    return { collection, index };
  })
  .catch((e) => {
    message.error(`Failed to load index profile: ${errToString(e)}, jump to manage page.`);
    navigateTo(`/main/collections/${collectionId}/manage`);
    return { collection: null, index: null };
  })
  .finally(() => (isLoading.value = false));
</script>
