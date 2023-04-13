<template>
  <div class="w-full h-full flex">
    <div class="m-auto flex flex-col">
      <a-spin class="m-auto!" :spinning="isLoading" />
      <div>Prepare new collection...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createCollection, errToString } from '#imports';
import { message } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { useCollectionStore } from '~/store/collections';

const isLoading = ref(true);

const collectionStore = useCollectionStore();
const { collectionNames } = storeToRefs(collectionStore);

await collectionStore
  .loadFromDb()
  .catch((e) => message.error(`Failed to create collection: ${errToString(e)}`))
  .finally(() => (isLoading.value = false));

function newCollectionName() {
  let i = 0;
  while (true) {
    i += 1;
    const newName = `Collection ${i}`;
    if (collectionNames.value.findIndex((name) => name == newName) == -1) {
      return newName;
    }
  }
}

async function prepareNewCollection() {
  const newName = newCollectionName();
  return await createCollection({
    documents: [],
    name: newName,
  });
}

await prepareNewCollection()
  .then(async (collection) => {
    await collectionStore.reloadCollectionById(collection.id);

    message.info(`New collection ${collection.name}#${collection.id}`);
    navigateTo(`/main/collections/${collection.id}/manage`);
  })
  .catch((e) => {
    message.error(`Failed to create collection: ${errToString(e)}`);
  });
</script>

<style lang="sass" scoped>
.ant-divider
  font-size: 14px
  font-weight: normal
</style>
