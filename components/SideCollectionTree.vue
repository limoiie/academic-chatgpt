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
        {{ col.name }}
      </template>
      <!--   New Index Profile   -->
      <a-menu-item key="add" @click="newDocumentsCollectionProfile(col.id)">
        New index
        <template #icon>
          <PlusCircleOutlined />
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
import { FolderAddOutlined, FolderOutlined, PlusCircleOutlined } from '@ant-design/icons-vue';
import { CollectionWithProfiles } from '~/utils/bindings';

const { collections } = defineProps<{ collections: CollectionWithProfiles[] }>();

async function navigateToIndexProfile(collectionId: number, indexProfileId: number) {
  navigateTo(`/main/collections/${collectionId}/indexes/${indexProfileId}`);
}

async function newDocumentsCollectionProfile(collectionId: number) {
  navigateTo(`/main/collections/${collectionId}/indexes/create`);
}

async function newDocumentsCollection() {
  navigateTo('/main/collections/create');
}
</script>
