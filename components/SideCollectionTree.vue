<!--suppress VueUnrecognizedSlot, TypeScriptUnresolvedReference -->
<template>
  <a-menu v-if="collections" class="overflow-auto" mode="inline" :theme="$colorMode.value">
    <a-menu-item key="newDocumentsCollection" class="!h-20" @click="newDocumentsCollection">
      New Collection
      <template #icon>
        <FolderAddOutlined />
      </template>
    </a-menu-item>
    <a-menu-divider />
    <a-sub-menu :key="col.id" v-for="col in collections">
      <template #icon>
        <FolderOutlined />
      </template>
      <template #title>
        {{ col.collection.name }}
      </template>
      <!--   new profile   -->
      <a-menu-item key="add" @click="newDocumentsCollectionProfile(col.collection.id)">
        New index
        <template #icon>
          <PlusCircleOutlined />
        </template>
      </a-menu-item>
      <!--   Profiles   -->
      <!--   todo:   -->
      <a-menu-item v-for="profile of col.profiles" :key="profile.profile.embeddingsId">
        {{ profile.profile.embeddingsId }}
        {{ profile.profile.indexId }}
      </a-menu-item>
    </a-sub-menu>
  </a-menu>
</template>

<script setup lang="ts">
import { FolderAddOutlined, FolderOutlined, PlusCircleOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { Collection, CollectionIndexProfile } from '~/utils/bindings';

const isLoading = ref(false);

interface ProfileUiData {
  profile: CollectionIndexProfile;
}

interface CollectionUiData {
  collection: Collection;
  profiles: ProfileUiData[];
}

const { data: collections } = useAsyncData('allCollections', async () => {
  isLoading.value = true;
  const collectionsUiData = [];
  try {
    const collections = await getCollections();
    for (const col of collections) {
      const profilesUiData = [];
      const profiles = await getIndexProfilesByCollectionId(col.id);
      for (const profile of profiles) {
        profilesUiData.push({
          profile: profile,
        } as ProfileUiData);
      }
      collectionsUiData.push({
        collection: col,
        profiles: profilesUiData,
      } as CollectionUiData);
    }
  } catch (e) {
    message.error(`Failed to load profiles: ${e}`);
  }

  isLoading.value = false;
  return collectionsUiData;
});

async function newDocumentsCollectionProfile(collectionId: number) {
  navigateTo(`/main/collections/${collectionId}/indexes/create`);
}

async function newDocumentsCollection() {
  navigateTo('/main/collections/create');
}
</script>
