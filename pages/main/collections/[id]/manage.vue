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
            v-model:value="formState.name"
            :bordered="false"
            @pressEnter="tryUpdateCollectionName"
            placeholder="Collection Name"
          />
        </div>
      </template>

      <template #extra>
        <a-tooltip title="Active Index Profile" placement="left">
          <a-select
            :value="formState.activeIndexId"
            :options="indexes || []"
            :field-names="{ label: 'name', value: 'id', options: 'options' }"
          />
        </a-tooltip>
        <a-button key="delete" type="dashed" shape="circle" danger>
          <template #icon>
            <DeleteOutlined />
          </template>
        </a-button>
      </template>
    </a-page-header>

    <a-layout-content class="mx-6">
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="documents" tab="Documents">
          <CollectionManageMain :id="id" :index-id="formState.activeIndexId || ''" />
        </a-tab-pane>
        <a-tab-pane key="indexes" tab="Indexes" force-render>
          <CollectionManageIndexes />
        </a-tab-pane>
      </a-tabs>
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import { DeleteOutlined, EditOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { reactive, ref } from 'vue';
import CollectionManageIndexes from '~/components/CollectionManageIndexes.vue';
import { useCollectionStore } from '~/store/collections';

const route = useRoute();
const id = parseInt(route.params['id'] as string);
const activeTab = ref<'documents' | 'indexes'>('documents');

const { $tauriCommands } = useNuxtApp();

const collectionStore = useCollectionStore();
const { collections, collectionIndexes, collectionNames } = storeToRefs(collectionStore);
const collection = computed(() => {
  const collection = collections.value.find((e) => e.id == id);
  if (!collection) return null;
  formState.name = collection.name;
  return collection;
});
const indexes = computed(() => {
  const indexes = collectionIndexes.value.get(id)?.map((e) => {
    return {
      id: e.id,
      name: e.name,
      indexProfile: e.index
    };
  });
  if (!indexes) return null;
  return indexes
});

const isUpdatingName = ref<boolean>(false);
const isCollectionNameChanged = computed(() => {
  return collection.value?.name != formState.name;
});
const viewCollectionName = ref<any | null>(null);
onMounted(() => {
  viewCollectionName.value.focus();
});

interface FormState {
  name: string;
  activeIndexId: string | undefined;
}

const formState = reactive<FormState>({
  name: '',
  activeIndexId: undefined,
});

await Promise.resolve()
  .then(() => collectionStore.load())
  .then(async () => {
    formState.activeIndexId = await collectionStore.getActiveIndexIdByCollectionId(id);
  })
  .catch((e) => {
    message.error(`Failed to load collection: ${errToString(e)}`);
  });

/**
 * Update collection name and reload the collection.
 */
async function tryUpdateCollectionName() {
  if (collectionNames.value.includes(formState.name)) {
    message.error('Failed to update name: already existing!');
    return;
  }

  await Promise.resolve((isUpdatingName.value = true))
    .then(() => $tauriCommands.updateCollectionName(id, formState.name))
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

function navigateToIndexes() {
  navigateTo(`/main/collections/${id}/indexes`);
}
</script>

<style lang="sass">
#collectionMain
  .ant-form-item
    margin-bottom: 0 !important
</style>
