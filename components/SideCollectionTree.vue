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
    <a-menu-item :key="col.id" v-for="col in collections" @click="navigateToDefaultIndexProfile(col.id)">
      <template #icon>
        <FolderOutlined />
      </template>
      <div class="flex flex-row group">
        <div class="flex flex-grow overflow-scroll">{{ col.name }}</div>
        <div class="hidden group-hover:flex flex-row my-auto ms-2">
          <a-button
            class="col-actions"
            shape="circle"
            size="small"
            type="dashed"
            @click="(e) => manageDocumentsCollectionProfile(e, col.id)"
          >
            <template #icon>
              <DashboardOutlined />
            </template>
          </a-button>
          <a-button
            class="col-actions"
            shape="circle"
            size="small"
            type="dashed"
            @click="(e) => deleteDocumentsCollection(e, col.id)"
          >
            <template #icon>
              <DeleteOutlined />
            </template>
          </a-button>
        </div>
      </div>
    </a-menu-item>
  </a-menu>
</template>

<script setup lang="ts">
import {
  DashboardOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  FolderAddOutlined,
  FolderOutlined,
} from '@ant-design/icons-vue';
import { createVNode } from '@vue/runtime-core';
import { message, Modal } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { useCollectionStore } from '~/store/collections';

const isLoading = ref<boolean>(false);

const collectionStore = useCollectionStore();
const { collections } = storeToRefs(collectionStore);

isLoading.value = true;
await collectionStore.loadFromDb().catch((e) => {
  message.error(`Failed to load profiles: ${e}`);
}).finally(() => {
  isLoading.value = false;
});

async function navigateToDefaultIndexProfile(collectionId: number) {
  navigateTo(`/main/collections/${collectionId}/indexes`);
}

async function manageDocumentsCollectionProfile(e: Event, collectionId: number) {
  navigateTo(`/main/collections/${collectionId}/manage`);
  e.stopPropagation();
}

async function newDocumentsCollection() {
  navigateTo('/main/collections/create');
}

async function deleteDocumentsCollection(e: Event, collectionId: number) {
  Modal.confirm({
    title: 'Do you want to continue?',
    icon: createVNode(ExclamationCircleOutlined),
    content: 'Delete collection will delete all its indexes and chat sessions.',
    okText: 'Yes',
    async onOk() {
      await collectionStore
        .deleteCollectionById(collectionId)
        .catch((e) => {
          message.error(`Failed to delete collection ${collectionId}: ${e.toString()}`);
        })
        .then(() => {
          message.info(`Deleted!`);
        });
    },
  });
  e.stopPropagation();
}
</script>

<style lang="sass">
.ant-menu-inline-collapsed
  .col-actions
    visibility: hidden
</style>
