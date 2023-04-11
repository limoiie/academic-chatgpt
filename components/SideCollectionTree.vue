<!--suppress VueUnrecognizedSlot -->
<template>
  <a-menu class="overflow-auto" mode="inline" :theme="$colorMode.value">
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
        <div class="flex flex-row items-center">
          {{ col.name }}
        </div>
      </template>
      <!--   New Index Profile   -->
      <a-menu-item key="add" @click="newDocumentsCollectionProfile(col.id)">
        New index
        <template #icon>
          <PlusCircleOutlined />
        </template>
      </a-menu-item>
      <a-menu-item key="manage" @click="manageDocumentsCollectionProfile(col.id)">
        Manage
        <template #icon>
          <DashboardOutlined />
        </template>
      </a-menu-item>
      <a-menu-item key="delete" @click="deleteDocumentsCollection(col.id)">
        Delete
        <template #icon>
          <DeleteOutlined />
        </template>
      </a-menu-item>
      <!--   Index Profiles   -->
      <a-menu-item
        v-for="profile of col.profiles"
        :key="profile.name"
        @click="navigateToIndexProfile(col.id, profile.id)"
      >
        {{ profile.name }}
      </a-menu-item>
    </a-sub-menu>
  </a-menu>
</template>

<script setup lang="ts">
import {
  DashboardOutlined,
  DeleteOutlined,
  FolderAddOutlined,
  FolderOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { useCollectionStore } from '~/store/collections';

const isLoading = ref<boolean>(false);

const collectionStore = useCollectionStore();
const { collections } = storeToRefs(collectionStore);

isLoading.value = true;
await collectionStore.loadFromDb().catch((e) => {
  message.error(`Failed to load profiles: ${e}`);
});
isLoading.value = false;

async function navigateToIndexProfile(collectionId: number, indexProfileId: number) {
  navigateTo(`/main/collections/${collectionId}/indexes/${indexProfileId}`);
}

async function manageDocumentsCollectionProfile(collectionId: number) {
  navigateTo(`/main/collections/${collectionId}/indexes/manage`);
}

async function newDocumentsCollectionProfile(collectionId: number) {
  navigateTo(`/main/collections/${collectionId}/indexes/create`);
}

async function newDocumentsCollection() {
  navigateTo('/main/collections/create');
}

async function deleteDocumentsCollection(collectionId: number) {
  await collectionStore
    .deleteCollectionById(collectionId)
    .catch((e) => {
      message.error(`Failed to delete collection ${collectionId}: ${e.toString()}`);
    })
    .then(() => {
      message.info(`Deleted!`);
    });
}
</script>
