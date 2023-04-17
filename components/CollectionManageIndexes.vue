<template>
  <a-space class="w-full" direction="vertical">
    <a-space>
      <a-button v-if="!hasSelected" class="ant-btn-with-icon" @click="add">
        <template #icon>
          <PlusCircleOutlined />
        </template>
        Add
      </a-button>
      <a-button v-if="hasSelected" class="ant-btn-with-icon" @click="removeSelected" danger>
        <template #icon>
          <ClearOutlined />
        </template>
        Remove
      </a-button>
      <a-button
        v-if="!hasSelected"
        :loading="loading"
        class="ant-btn-with-icon"
        @click="collectionStore.loadIndexesFromDatabase"
      >
        <template #icon>
          <ReloadOutlined />
        </template>
        Refresh
      </a-button>
    </a-space>
    <a-table
      :data-source="indexesUiData"
      :columns="columns || []"
      :row-selection="{ selectedRowKeys: selectedRawKeys, onChange: onSelectionChanged }"
      :row-key="(record) => record.id"
      :scroll="{ x: 200 }"
      :loading="loading"
      @resizeColumn="handleResizeColumn"
    >
      <template #expandedRowRender="{ record }">
        <pre class="m-0">{{ stringify(record.origin) }}</pre>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button size="small" shape="circle" @click="open(record.indexId)">
              <template #icon>
                <CommentOutlined />
              </template>
            </a-button>

            <a-button size="small" shape="circle" @click="remove(record.id)" danger>
              <template #icon>
                <DeleteOutlined />
              </template>
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>
  </a-space>
</template>

<script setup lang="ts">
import { useRoute } from '#app';
import {
  ClearOutlined,
  CommentOutlined,
  DeleteOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue';
import { message, TableColumnsType, TableColumnType } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import { stringify } from 'yaml';
import { useCollectionStore } from '~/store/collections';
import { CollectionIndexWithAll, deleteCollectionIndexesById } from '~/utils/bindings';

const columns = ref<TableColumnsType>([
  {
    title: 'Name',
    dataIndex: 'name',
    width: 100,
    fixed: 'left' as 'left',
    resizable: true,
  },
  {
    title: 'Splitting',
    dataIndex: 'splitting',
    width: 120,
    ellipsis: true,
    resizable: true,
  },
  {
    title: 'Embeddings Config',
    dataIndex: 'embeddingsConfig',
    width: 160,
    ellipsis: true,
    resizable: true,
  },
  {
    title: 'Vector Db Config',
    dataIndex: 'vectorDbConfig',
    width: 200,
    ellipsis: true,
    resizable: true,
  },
  {
    title: 'Action',
    key: 'action',
    width: 80,
    fixed: 'right' as 'right',
  },
]);

const route = useRoute();
const collectionStore = useCollectionStore();
const collectionId = parseInt(route.params['id'] as string);

const loading = ref<boolean>(false);
const selectedRawKeys = ref<string[]>([]);
const hasSelected = computed(() => selectedRawKeys.value.length != 0);

const { indexesByCollectionId: indexesByCollectionId } = storeToRefs(collectionStore);
const indexes = computed(() => {
  return indexesByCollectionId.value.get(collectionId) || [];
});

const indexesUiData = computed(() => indexes.value.map(dbDataToUi));

await Promise.resolve((loading.value = true))
  .then(() => collectionStore.loadIndexesFromDatabase())
  .finally(() => (loading.value = false));

interface IndexProfileUiData {
  id: string;
  indexId: number;
  name: string;
  indexName: string;
  splitting: string;
  embeddingsConfig: string;
  vectorDbConfig: string;
  origin: CollectionIndexWithAll;
}

function dbDataToUi(indexProfile: CollectionIndexWithAll) {
  return {
    id: indexProfile.id,
    indexId: indexProfile.indexId,
    name: indexProfile.name,
    indexName: indexProfile.index.name,
    splitting: indexProfile.index.splittingId.toString(),
    embeddingsConfig: indexProfile.index.embeddingsConfig.name,
    vectorDbConfig: indexProfile.index.vectorDbConfig.name,
    origin: indexProfile,
  } as IndexProfileUiData;
}

async function open(id: number) {
  const targetIndexPageUrl = route.path.replace(/\/manage$/, `/indexes/${id}`);
  navigateTo(targetIndexPageUrl);
}

async function add() {
  message.warn('Not implemented yet');
  await collectionStore.reloadCollectionById(collectionId);
}

async function remove(id: string) {
  await removeIndexProfiles([id]);
  await collectionStore.reloadCollectionById(collectionId);
}

async function removeSelected() {
  const selected = selectedRawKeys.value;
  if (selected.length > 0) {
    await removeIndexProfiles(selected);
    selectedRawKeys.value = [];
  }
  await collectionStore.reloadCollectionById(collectionId);
}

async function removeIndexProfiles(indexProfileIds: string[]) {
  if (indexProfileIds.length > 0) {
    const deleted = await deleteCollectionIndexesById(indexProfileIds);
    if (deleted != indexProfileIds.length) {
      message.warn(`Failed to delete: ${indexProfileIds.length} to delete, only ${deleted} deleted`);
    }
  }
}

function onSelectionChanged(selected: string[]) {
  selectedRawKeys.value = selected;
}

function handleResizeColumn(w: number, col: TableColumnType) {
  col.width = w;
}
</script>

<style lang="sass" scoped>
.ant-divider
  font-size: 14px
  font-weight: normal
</style>
