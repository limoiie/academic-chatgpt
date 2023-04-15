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
    </div>
  </div>
</template>

<script setup lang="ts">
import { errToString } from '#imports';
import { message } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { useCollectionStore } from '~/store/collections';
import { useIndexProfilesStore } from '~/store/indexProfiles';

const isLoading = ref<boolean>(false);
const errorMessage = ref<string>('');

const collectionStore = useCollectionStore();
const indexProfilesStore = useIndexProfilesStore();

const { defaultIndexProfile } = storeToRefs(indexProfilesStore);

/**
 * Create a new collection and a new index profile for it.
 *
 * @returns The new collection.
 */
async function prepareNewCollection() {
  if (!defaultIndexProfile.value) {
    throw new Error('No default index profile');
  }

  return await collectionStore.createCollection(defaultIndexProfile.value);
}

await Promise.resolve((isLoading.value = true))
  .then(async () => {
    await collectionStore.load();
    await indexProfilesStore.load();
    return await prepareNewCollection();
  })
  .then((collection) => {
    message.info(`New collection ${collection.name}#${collection.id}`);
    navigateTo(`/main/collections/${collection.id}/manage`);
  })
  .catch((error) => {
    errorMessage.value = errToString(error);
  })
  .finally(() => (isLoading.value = false));
</script>

<style lang="sass" scoped>
.ant-divider
  font-size: 14px
  font-weight: normal
</style>
