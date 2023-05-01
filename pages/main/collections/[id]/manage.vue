<template>
  <a-layout>
    <a-page-header class="z-10" title="Manage" @back="navigateToIndexes">
      <template #subTitle>
        <div class="flex flex-row items-center">
          <a-button
            v-show="isCollectionNameChanged"
            shape="circle"
            size="small"
            :disabled="!isCollectionNameChanged"
            :loading="isUpdatingName"
            @click="tryUpdateCollectionName"
          >
            <template #icon>
              <EditOutlined />
            </template>
          </a-button>
          <a-input
            ref="viewCollectionName"
            v-model:value="collectionName"
            :bordered="false"
            @pressEnter="tryUpdateCollectionName"
            placeholder="Collection Name"
          />
        </div>
      </template>

      <template #extra>
        <a-tooltip title="Active Index Profile" :mouse-enter-delay="1">
          <a-select
            v-if="indexes && indexes.length > 0"
            v-model:value="activeIndexId"
            :options="indexes"
            :field-names="{ label: 'name', value: 'id', options: 'options' }"
          />
        </a-tooltip>
        <a-button key="delete" type="dashed" shape="circle" @click="(e) => deleteCollection(e)" danger>
          <template #icon>
            <DeleteOutlined />
          </template>
        </a-button>
      </template>
    </a-page-header>

    <a-layout-content class="mx-6">
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="documents" tab="Documents">
          <CollectionManageMain :id="id" :index="activeIndex" />
        </a-tab-pane>
        <a-tab-pane key="indexes" tab="Indexes" force-render>
          <CollectionManageIndexes :indexes="indexes" :reload="refreshIndexes" :remove="clearCollectionIndexes" />
        </a-tab-pane>
      </a-tabs>
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import { DeleteOutlined, EditOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { useConfirmDeleteCollection } from '~/composables/useConfirmDeleteCollection';
import { useCollectionStore } from '~/store/collections';

const { $tauriCommands } = useNuxtApp();

const viewCollectionName = ref<any | null>(null);

const isUpdatingName = ref<boolean>(false);
const collectionName = ref('');
const isCollectionNameChanged = computed(() => {
  return collection.value?.name != collectionName.value;
});

const route = useRoute();
const id = parseInt(route.params['id'] as string);
const activeTab = ref<'documents' | 'indexes'>('documents');

const collectionStore = useCollectionStore();
const { collections, collectionNames } = storeToRefs(collectionStore);
const collection = computed(() => {
  const collection = collections.value.find((e) => e.id == id);
  if (collection) {
    collectionName.value = collection.name;
  }
  return collection;
});

const {
  indexes,
  activeIndex,
  activeIndexId,
  refresh: refreshIndexes,
  clear: clearIndexes,
} = collectionStore.useCollectionIndexes(id);

onMounted(async () => {
  viewCollectionName.value.focus();

  await Promise.resolve()
    .then(() => collectionStore.load())
    .catch((e) => {
      message.error(`Failed to load collection: ${errToString(e)}`);
    });
});

onUnmounted(async () => {
  await collectionStore.storeCacheToTauriStore();
});

/**
 * Update collection name and reload the collection.
 */
async function tryUpdateCollectionName() {
  if (collectionNames.value.includes(collectionName.value)) {
    message.error('Failed to update name: already existing!');
    return;
  }

  await Promise.resolve((isUpdatingName.value = true))
    .then(() => $tauriCommands.updateCollectionName(id, collectionName.value))
    .then(async (data) => {
      await collectionStore.reloadCollectionById(id);
      message.info(`Updated name as '${data.name}'`);
    })
    .catch((e) => {
      message.error(`Failed to update name: ${errToString(e)}`);
    })
    .finally(() => {
      isUpdatingName.value = false;
    });
}

/**
 * Delete collection.
 *
 * If the active collection is deleted, navigate to the next collection.
 */
async function deleteCollection(e: Event | undefined = undefined) {
  await useConfirmDeleteCollection(id, e);
}

async function clearCollectionIndexes(indexIds: string[]) {
  message.loading('Clearing indexes...', 1);
  await Promise.resolve()
    .then(() => clearIndexes(indexIds))
    .then(async (cleared) => {
      message.success(`Cleared ${cleared.length} indexes`);
    })
    .catch((e) => {
      message.error(`Failed to clear indexes: ${errToString(e)}`);
    });
}

function navigateToIndexes() {
  navigateTo(`/main/collections/${id}/indexes`);
}
</script>

<style lang="sass">
#collectionMain
  .ant-form-item
    margin-bottom: 0 !important
</style>
