<template>
  <a-layout>
    <a-layout-content class="mx-8 mt-2 mb-8">
      <a-divider orientation="left" orientation-margin="0">Manage index profiles</a-divider>
      <a-space class="w-full" direction="vertical">
        <a-space>
          <a-button v-if="!hasSelected" @click="add">
            <template #icon>
              <PlusCircleOutlined />
            </template>
            Add more
          </a-button>
          <a-button v-if="hasSelected" @click="removeSelected" danger>
            <template #icon>
              <ClearOutlined />
            </template>
            Remove
          </a-button>
          <a-button v-if="!hasSelected" :loading="loading" @click="refreshIndexProfiles">
            <template #icon>
              <ReloadOutlined />
            </template>
            Refresh
          </a-button>
        </a-space>
        <a-table
          :data-source="indexProfilesUiData"
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
              <div class="w-full flex flex-col items-center">
                <a-space>
                  <a-button size="small" shape="circle" @click="open(record.id)">
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
              </div>
            </template>
          </template>
        </a-table>
      </a-space>
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import { useAsyncData, useRoute } from '#app';
import {
  ClearOutlined,
  CommentOutlined,
  DeleteOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue';
import { message, TableColumnsType, TableColumnType } from 'ant-design-vue';
import { ref } from 'vue';
import { stringify } from 'yaml';
import { deleteIndexProfilesById, getIndexProfilesByCollectionIdWithAll, IndexProfileWithAll } from '~/utils/bindings';

const route = useRoute();
const collectionId = parseInt(route.params['id'] as string);

const loading = ref<boolean>(false);
const selectedRawKeys = ref<number[]>([]);
const hasSelected = computed(() => selectedRawKeys.value.length != 0);

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

const { data: indexProfiles, refresh: refreshIndexProfiles } = useAsyncData(
  `profilesOfCollection${collectionId}`,
  async () => {
    loading.value = true;
    let data: IndexProfileWithAll[] = [];
    try {
      data = await getIndexProfilesByCollectionIdWithAll(collectionId);
    } catch (e: any) {
      message.error(`Failed to load: ${e.toString()}`);
    }
    loading.value = false;
    return data;
  },
);

interface IndexProfileUiData {
  id: number;
  name: string;
  splitting: string;
  embeddingsConfig: string;
  vectorDbConfig: string;
  origin: IndexProfileWithAll;
}

function dbDataToUi(indexProfile: IndexProfileWithAll) {
  return {
    id: indexProfile.id,
    name: indexProfile.name,
    splitting: [indexProfile.splitting.chunkSize.toString(), indexProfile.splitting.chunkOverlap.toString()].join('-'),
    embeddingsConfig: indexProfile.embeddingsConfig.name,
    vectorDbConfig: indexProfile.vectorDbConfig.name,
    origin: indexProfile,
  } as IndexProfileUiData;
}

const indexProfilesUiData = ref<IndexProfileUiData[]>([]);
watch(indexProfiles, (newIndexProfiles) => {
  indexProfilesUiData.value = (newIndexProfiles || []).map(dbDataToUi);
});

async function open(id: number) {
  const targetIndexPageUrl = route.path.replace(/\/manage$/, `/${id}`);
  navigateTo(targetIndexPageUrl);
}

async function add() {
  message.warn('Not implemented yet')
}

async function remove(id: number) {
  await removeIndexProfiles([id]);
}

async function removeIndexProfiles(indexProfileIds: number[]) {
  if (indexProfileIds.length > 0) {
    const deleted = await deleteIndexProfilesById(indexProfileIds);
    if (deleted != indexProfileIds.length) {
      message.warn(`Failed to delete: ${indexProfileIds.length} to delete, only ${deleted} deleted`);
      await refreshIndexProfiles();
    } else {
      indexProfiles.value = indexProfiles.value?.filter((e) => !indexProfileIds.includes(e.id)) || null;
    }
  }
}

async function removeSelected() {
  const selected = selectedRawKeys.value;
  if (selected.length > 0) {
    await removeIndexProfiles(selected);
    selectedRawKeys.value = [];
  }
}

function onSelectionChanged(selected: number[]) {
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
