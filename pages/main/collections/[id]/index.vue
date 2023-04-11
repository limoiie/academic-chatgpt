<template>
  Collection {{ route.path }}
  <a-spin :spinning="loading" />
</template>

<script setup lang="ts">
import { useRoute } from '#app';
import { storeToRefs } from 'pinia';
import { useCollectionStore } from '~/store/collections';
import { CollectionIndexProfile } from '~/utils/bindings';

const loading = ref(false);

const route = useRoute();
const collectionId = parseInt(route.params['id'] as string);
const collectionStore = useCollectionStore();

loading.value = true;
await collectionStore.loadFromDb();
await collectionStore.loadIndexProfilesFromDb();
loading.value = false;

const { collections } = storeToRefs(collectionStore);
const collection = computed(() => collections.value[collectionId]);
const indexProfiles = computed(() => collection.value.profiles);
const handler = watch(indexProfiles, () => {
  navigate(indexProfiles.value);
  handler();
});

function navigate(indexProfiles: CollectionIndexProfile[]) {
  const indexProfile = indexProfiles[0];
  if (indexProfile) {
    navigateTo(route.path + `/indexes/${indexProfile.id}`);
  } else {
    navigateTo(route.path + `/indexes/create`);
  }
}
</script>
