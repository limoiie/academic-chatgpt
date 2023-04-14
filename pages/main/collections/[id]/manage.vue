<template>
  <a-layout>
    <a-page-header class="bg-white border-b-1 z-10" title="Manage" @back="() => $router.go(-1)">
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
            placeholder="Collection Name"
          />
        </div>
      </template>

      <template #extra>
        <a-tooltip title="Active Index Profile" placement="left">
          <a-select
            :value="formState.defaultIndex"
            :options="collection.indexProfiles"
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
      <a-tabs v-model:activeKey="activeKey">
        <a-tab-pane key="documents" tab="Documents">
          <CollectionManageMain :id="id" />
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

const isUpdatingName = ref<boolean>(false);
const viewCollectionName = ref<any | null>(null);
onMounted(() => {
  viewCollectionName.value.focus();
});

const route = useRoute();
const id = parseInt(route.params['id'] as string);
const activeKey = ref<'documents' | 'indexes'>('documents');

const collectionStore = useCollectionStore();
const { collections, collectionNames } = storeToRefs(collectionStore);
const collection = computed(() => {
  const collection = collections.value.find((e) => e.id == id);
  if (collection) {
    formState.name = collection.name;
    formState.defaultIndex = collection.indexProfiles.at(0)?.id;
  }
  return collection;
});
const isCollectionNameChanged = computed(() => {
  return collection.value?.name != formState.name;
});

interface FormState {
  name: string;
  defaultIndex: number | undefined;
}

const formState = reactive<FormState>({
  name: '',
  defaultIndex: undefined,
});

async function tryUpdateCollectionName() {
  if (collectionNames.value.includes(formState.name)) {
    message.error('Failed to update name: already existing!');
    return;
  }

  isUpdatingName.value = true;
  await updateCollectionName(id, formState.name)
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

async function checkIndexSyncStatus() {
  message.warn('Not implemented yet');
}

async function syncIndex() {
  message.warn('Not implemented yet');
}
</script>

<style lang="sass">
#collectionMain
  .ant-form-item
    margin-bottom: 0 !important
//    margin-top: 16px
</style>
