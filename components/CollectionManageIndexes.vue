<template>
  <a-space class="w-full" direction="vertical">
    <CreateIndexProfile v-model:visible="creating" @on-created="onCreated" />
    <a-drawer v-model:visible="previewing" title="Preview index settings">
      <PreviewCollectionIndex :index="indexPreviewing" />
    </a-drawer>

    <!-- control buttons bar -->
    <a-space>
      <a-button v-if="!hasSelected" shape="circle" @click="openCreatingDrawer">
        <template #icon>
          <PlusOutlined />
        </template>
      </a-button>
      <a-button v-if="hasSelected" shape="circle" @click="removeSelected" danger>
        <template #icon>
          <ClearOutlined />
        </template>
      </a-button>
      <a-button v-if="!hasSelected" :loading="loading" shape="circle" @click="reload">
        <template #icon>
          <ReloadOutlined />
        </template>
      </a-button>
    </a-space>

    <!-- index profile table -->
    <a-table
      :data-source="indexesUiData"
      :columns="columns || []"
      :row-selection="{ selectedRowKeys: selectedRawKeys, onChange: onSelectionChanged }"
      :row-key="(record) => record.id"
      :scroll="{ x: 200 }"
      :loading="loading"
      @resizeColumn="handleResizeColumn"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button size="small" shape="circle" @click="open(record.indexId)">
              <template #icon>
                <CommentOutlined />
              </template>
            </a-button>

            <a-button size="small" shape="circle" @click="preview(record)">
              <template #icon>
                <FundViewOutlined />
              </template>
            </a-button>

            <a-button size="small" shape="circle" @click="remove(record.id)" danger>
              <template #icon>
                <ClearOutlined />
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
import { ClearOutlined, CommentOutlined, FundViewOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { message, TableColumnsType, TableColumnType } from 'ant-design-vue';
import { ref, toRefs } from 'vue';
import { CollectionIndexWithAll } from '~/plugins/tauri/bindings';

const columns = ref<TableColumnsType>([
  {
    title: 'Name',
    dataIndex: 'name',
    width: 160,
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
    width: 120,
    fixed: 'right' as 'right',
  },
]);

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

const { $tauriCommands } = useNuxtApp();

const loading = ref<boolean>(false);
const creating = ref<boolean>(false);
const previewing = ref<boolean>(false);
const indexPreviewing = ref<CollectionIndexWithAll | undefined>(undefined);

const selectedRawKeys = ref<string[]>([]);
const hasSelected = computed(() => selectedRawKeys.value.length != 0);

const props = defineProps<{
  indexes: CollectionIndexWithAll[];
  reload?: () => Promise<void>;
}>();
const { indexes, reload = () => {} } = toRefs(props);
const indexesUiData = computed(() => indexes.value.map(dbDataToUi));

const route = useRoute();
const collectionId = parseInt(route.params['id'] as string);

async function openCreatingDrawer() {
  creating.value = true;
}

async function onCreated() {
  creating.value = false;
}

async function open(id: number) {
  const targetIndexPageUrl = route.path.replace(/\/manage$/, `/indexes/${id}`);
  navigateTo(targetIndexPageUrl);
}

async function remove(id: string) {
  await removeIndexProfiles([id]);
}

async function preview(record: CollectionIndexWithAll) {
  previewing.value = true;
  indexPreviewing.value = record;
}

async function removeSelected() {
  const selected = selectedRawKeys.value;
  if (selected.length > 0) {
    await removeIndexProfiles(selected);
    selectedRawKeys.value = [];
  }
}

async function removeIndexProfiles(indexProfileIds: string[]) {
  // todo: just clear, not delete
  if (indexProfileIds.length > 0) {
    const deleted = await $tauriCommands.deleteCollectionIndexesById(indexProfileIds);
    if (deleted != indexProfileIds.length) {
      message.warn(`Failed to delete: ${indexProfileIds.length} to delete, only ${deleted} deleted`);
    }
  }
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
