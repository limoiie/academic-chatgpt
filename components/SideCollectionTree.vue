<!--suppress VueUnrecognizedSlot -->
<template>
  <a-menu class="overflow-auto" :selected-keys="[activeCollectionId]" mode="inline">
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
        <!--suppress TypeScriptUnresolvedReference -->
        <FolderOpenOutlined v-if="col.id == activeCollectionId" />
        <FolderOutlined v-else />
      </template>
      <div class="flex flex-row group h-6 items-center">
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
            @click="(e) => deleteCollection(col.id, e)"
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
  FolderAddOutlined,
  FolderOpenOutlined,
  FolderOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { useConfirmDeleteCollection } from '~/composables/useConfirmDeleteCollection';
import { useCollectionStore } from '~/store/collections';

const isLoading = ref<boolean>(false);

const collectionStore = useCollectionStore();
const { collections, activeCollectionId } = storeToRefs(collectionStore);

await Promise.resolve((isLoading.value = true))
  .then(() => collectionStore.load())
  .then(() => {
    if (activeCollectionId.value != null) {
      navigateToActiveIndexProfile(activeCollectionId.value);
    } else {
      navigateTo('/main/collections');
    }
  })
  .catch((e) => {
    message.error(`Failed to load profiles: ${e}`);
  })
  .finally(() => {
    isLoading.value = false;
  });

async function navigateToActiveIndexProfile(collectionId: number) {
  if (collectionId != activeCollectionId.value) {
    navigateTo(`/main/collections/${collectionId}/indexes`);
  }
}

async function manageCollectionProfile(collectionId: number, e: Event | undefined = undefined) {
  navigateTo(`/main/collections/${collectionId}/manage`);
  e?.stopPropagation();
}

async function newCollection() {
  navigateTo('/main/collections/create');
}

/**
 * Delete collection.
 *
 * If the active collection is deleted, navigate to the next collection.
 */
async function deleteCollection(collectionId: number, e: Event | undefined = undefined) {
  await useConfirmDeleteCollection(collectionId, e);
}
</script>

<style lang="sass">
.ant-menu-inline-collapsed
  .col-actions
    visibility: hidden
</style>
