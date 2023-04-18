<!--suppress VueUnrecognizedSlot -->
<template>
  <a-menu class="overflow-auto" :selected-keys="[activeCollectionId]" mode="inline" :theme="$colorMode.value">
    <a-menu-item key="create" class="!h-20" @click="newCollection">
      New Collection
      <template #icon>
        <FolderAddOutlined />
      </template>
    </a-menu-item>
    <a-menu-divider />
    <!--suppress TypeScriptUnresolvedReference -->
    <a-menu-item :key="col.id" v-for="col in collections" @click="navigateToActiveIndexProfile(col.id)">
      <template #icon>
        <FolderOutlined />
      </template>
      <div class="flex flex-row group">
        <!--suppress TypeScriptUnresolvedReference -->
        <div class="flex flex-grow overflow-scroll">{{ col.name }}</div>
        <div class="hidden group-hover:flex flex-row my-auto ms-2">
          <!--suppress TypeScriptUnresolvedReference -->
          <a-button
            class="col-actions"
            shape="circle"
            size="small"
            type="dashed"
            @click="(e) => manageCollectionProfile(col.id, e)"
          >
            <template #icon>
              <DashboardOutlined />
            </template>
          </a-button>
          <!--suppress TypeScriptUnresolvedReference -->
          <a-button
            class="col-actions"
            shape="circle"
            size="small"
            type="dashed"
            @click="(e) => confirmDeletingCollection(col.id, e)"
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
import { useCollectionsStore } from '~/store/collections';

const isLoading = ref<boolean>(false);
const activeCollectionId = ref<number>();

const route = useRoute();
watch(route, async () => {
  await updateActiveCollection();
});

const collectionStore = useCollectionsStore();
const { collections } = storeToRefs(collectionStore);

await Promise.resolve((isLoading.value = true))
  .then(() => collectionStore.load())
  .then(() => {
    const historyActiveCollectionId = collectionStore.getActiveCollectionId();
    if (historyActiveCollectionId != null) {
      navigateToActiveIndexProfile(historyActiveCollectionId);
    } else if (historyActiveCollectionId != activeCollectionId.value) {
      navigateTo('/main/collections');
    }
  })
  .catch((e) => {
    message.error(`Failed to load profiles: ${e}`);
  })
  .finally(() => {
    isLoading.value = false;
  });

/**
 * Update active collection id from route params.
 */
async function updateActiveCollection() {
  const paramId = route.params.id;
  if (typeof paramId === 'string') {
    const collectionId = Number(paramId);
    await collectionStore.setActiveCollectionId(collectionId);
    activeCollectionId.value = collectionId;
  }
}

async function navigateToActiveIndexProfile(collectionId: number) {
  navigateTo(`/main/collections/${collectionId}/indexes`);
}

async function manageCollectionProfile(collectionId: number, e: Event | undefined = undefined) {
  navigateTo(`/main/collections/${collectionId}/manage`);
  e?.stopPropagation();
}

async function newCollection() {
  navigateTo('/main/collections/create');
}

/**
 * Open a confirm dialog to delete collection.
 */
async function confirmDeletingCollection(collectionId: number, e: Event | undefined = undefined) {
  Modal.confirm({
    title: 'Do you want to continue?',
    icon: createVNode(ExclamationCircleOutlined),
    content: 'Delete collection will delete all its indexes and chat sessions.',
    okText: 'Yes',
    async onOk() {
      await deleteCollection(collectionId);
    },
  });
  e?.stopPropagation();
}

/**
 * Delete collection and navigate to fallback collection if exists.
 */
async function deleteCollection(collectionId: number) {
  await collectionStore
    .deleteCollectionById(collectionId)
    .then(({ deleted, fallback }) => {
      if (deleted) {
        if (fallback) {
          navigateTo(`/main/collections/${fallback.id}`);
        }
        message.info(`Deleted collection#${collectionId}!`);
      } else {
        message.warn(`Unable to delete collection#${collectionId}: not found`);
      }
    })
    .catch((e) => {
      message.error(`Failed to delete collection#${collectionId}: ${errToString(e)}`);
    });
}
</script>

<style lang="sass">
.ant-menu-inline-collapsed
  .col-actions
    visibility: hidden
</style>
