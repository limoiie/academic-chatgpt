<template>Collection {{ route.path }}</template>

<script setup lang="ts">
import { useAsyncData, useRoute } from '#app';
import { CollectionIndexProfile } from '~/utils/bindings';

const route = useRoute();
const collectionId = parseInt(route.params['id'] as string);

useAsyncData(`profilesOfCollection${collectionId}`, async () => {
  const indexProfiles = await getIndexProfilesByCollectionId(collectionId);
  navigate(indexProfiles);
  return indexProfiles;
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
