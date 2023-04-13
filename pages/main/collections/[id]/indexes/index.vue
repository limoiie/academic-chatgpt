<template>
  <div class="w-full h-full flex">
    <div class="m-auto flex flex-col">
      <a-spin class="m-auto!" />
      <div>Loading index profiles...</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useCollectionStore } from '~/store/collections';

const route = useRoute();
const collectionStore = useCollectionStore();
const collectionId = parseInt(route.params['id'] as string);

const loading = ref<boolean>(false);

const { indexProfilesByCollectionId } = storeToRefs(collectionStore);
const indexProfiles = computed(() => {
  return indexProfilesByCollectionId.value.get(collectionId) || [];
});

const defaultIndexProfile = indexProfiles.value.at(0);
if (defaultIndexProfile) {
  navigateTo(`${route.path}/${defaultIndexProfile.id}`);
} else {
  navigateTo(`${route.path}/create`);
}
</script>
