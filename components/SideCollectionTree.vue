<!--suppress VueUnrecognizedSlot, TypeScriptUnresolvedReference -->
<template>
  <!--  Hello, this is side collection tree-->
  <a-menu v-if="collections" class="overflow-auto" mode="inline" :theme="$colorMode.value">
    <a-modal
      title="Create Profile for Collection"
      v-model:visible="isNewProfileModalShowing"
      :confirm-loading="isNewProfileCreating"
      @ok="finishNewProfile"
    >
      <CreateProfile v-if="currentCollectionId" :collection-id="currentCollectionId as number" />
    </a-modal>

    <a-menu-item key="newDocumentsCollection" class="!h-20" @click="newDocumentsCollection">
      New Collection
      <template #icon>
        <FolderAddOutlined />
      </template>
    </a-menu-item>
    <a-menu-divider></a-menu-divider>
    <a-sub-menu :key="col.id" v-for="col in collections">
      <template #icon>
        <FolderOutlined />
      </template>
      <template #title>
        {{ col.collection.name }}
      </template>
      <!--   Add profile   -->
      <a-menu-item key="add" @click="showNewProfile(col.collection.id)">
        Add profile
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
import { Collection, IndexEmbeddingsOnCollection } from '~/utils/bindings';

const isNewProfileModalShowing = ref(false);
const isNewProfileCreating = ref(false);
const isLoading = ref(false);

const currentCollectionId = ref<number | undefined>(undefined);

interface ProfileUiData {
  profile: IndexEmbeddingsOnCollection;
  name: string;
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
      const profiles = await getIndexEmbeddingsByCollection(col.id);
      for (const profile of profiles) {
        profilesUiData.push({
          profile: profile,
          name: 'todo', // todo,
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

async function showNewProfile(collectionId: number) {
  currentCollectionId.value = collectionId;
  isNewProfileModalShowing.value = true;
}

async function finishNewProfile() {
  isNewProfileCreating.value = true;
  try {
    // todo: create
    //  add to db
    //  add to ui
    message.info(`New profile created for collection ${currentCollectionId.value}`);
  } catch (e) {
    message.error(`Failed to create profile: ${e}`);
  }
  isNewProfileCreating.value = false;
  isNewProfileModalShowing.value = false;
}

async function newDocumentsCollection() {
  navigateTo('/main/collections/create');
}
</script>
