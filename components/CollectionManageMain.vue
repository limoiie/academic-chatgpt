<template>
  <a-space class="w-full" direction="vertical">
    <a-modal title="Adding..." :visible="isAdding" :closable="false">
      <a-space class="w-full" direction="vertical">
        <p class="whitespace-nowrap overflow-scroll">Working on {{ workingOn }}...</p>
        <a-progress :percent="progress.percentage.value" />
        <p class="whitespace-nowrap overflow-scroll">{{ progress.inlineMessage.value }}</p>
        <a-collapse v-model:activeKey="showDetails" ghost>
          <template #expandIcon></template>
          <a-collapse-panel key="1">
            <template #header>
              <a-button :type="showDetails == '1' ? 'primary' : 'dashed'" size="small" round>Details</a-button>
            </template>
            <LogConsole
              class="border-0 max-h-32 overflow-scroll"
              :scroll-to-end="progress.updated.value % 2 == 1"
              :logs="progress.logs.value"
            />
          </a-collapse-panel>
        </a-collapse>
      </a-space>
    </a-modal>

    <a-modal title="Syncing..." :visible="isSyncing" :closable="false" @cancel="() => (isSyncing = false)">
      <TraceBar :tracer-status="indexTracer" />
    </a-modal>

    <a-space class="w-full" direction="vertical">
      <a-space>
        <a-button v-if="!hasSelected" class="ant-btn-with-icon" @click="addDocuments">
          <template #icon>
            <PlusCircleOutlined />
          </template>
          Add
        </a-button>
        <a-button v-if="hasSelected" class="ant-btn-with-icon" @click="removeSelectedDocuments" danger>
          <template #icon>
            <ClearOutlined />
          </template>
          Remove
        </a-button>
        <a-button v-if="!hasSelected" :loading="isLoading" class="ant-btn-with-icon" @click="reloadDocuments">
          <template #icon>
            <ReloadOutlined />
          </template>
          Refresh
        </a-button>
        <a-tooltip title="Reload sync status">
          <a-button
            :loading="isComputingSync"
            :disabled="isAdding || isLoading"
            shape="circle"
            @click="recomputeIndexSyncStatus"
          >
            <template #icon>
              <DiffOutlined />
            </template>
          </a-button>
        </a-tooltip>
        <a-tooltip :title="`Sync changes: ${syncStatusBrief}.`">
          <a-button
            :loading="isSyncing || isComputingSync"
            :disabled="isAdding || isLoading || !indexSyncStatus"
            :type="indexSyncStatus?.clean ? 'dashed' : 'primary'"
            shape="circle"
            @click="syncIndex"
          >
            <template #icon>
              <CloudSyncOutlined />
            </template>
          </a-button>
        </a-tooltip>
      </a-space>
      <a-table
        :data-source="uiDocuments"
        :columns="columns"
        :scroll="{ x: 200 }"
        :row-selection="{ selectedRowKeys: selectedDocumentIds, onChange: onSelectionChanged }"
        :loading="isLoading"
        @resizeColumn="handleResizeColumn"
      >
        <template #headerCell="{ column }">
          <template v-if="column.key === 'filename'">
            <span> Filename </span>
          </template>
        </template>

        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'action'">
            <a-space>
              <a-button size="small" shape="circle" @click="removeDocument(record.key)" danger>
                <template #icon>
                  <DeleteOutlined />
                </template>
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-space>
  </a-space>
</template>

<script setup lang="ts">
import {
  ClearOutlined,
  CloudSyncOutlined,
  DeleteOutlined,
  DiffOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons-vue';
import { open } from '@tauri-apps/api/dialog';
import { message, TableColumnType } from 'ant-design-vue';
import { basename } from 'pathe';
import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import { useCollectionStore } from '~/store/collections';
import { ProgressLogger } from '~/types';
import {
  CollectionIndexWithAll,
  CreateDocumentData,
  deleteDocumentsInCollection,
  Document,
  getDocumentsByCollectionId,
  getOrCreateDocument,
} from '~/utils/bindings';
import { IndexSyncStatus } from '~/utils/indexSyncStatus';
import { IndexTracer } from '~/utils/indexTracer';

const columns = [
  {
    title: 'Filename',
    dataIndex: 'filename',
    key: 'filename',
    width: 180,
    fixed: 'left' as 'left',
    resizable: true,
  },
  {
    title: 'Filepath',
    dataIndex: 'filepath',
    key: 'filepath',
    width: 400,
    resizable: true,
  },
  {
    title: 'MD5',
    dataIndex: 'md5',
    key: 'md5',
    width: 200,
    resizable: true,
  },
  {
    title: 'Action',
    key: 'action',
    width: 80,
    fixed: 'right' as 'right',
  },
];

interface DocumentUiData {
  key: number;
  filename: string;
  filepath: string;
  md5: string;
}

const props = defineProps<{ id: number; indexId: string | undefined }>();
const { id } = props;
const indexId = toRef(props, 'indexId');

const isLoading = ref<boolean>(false);
const isAdding = ref<boolean>(false);
const isComputingSync = ref<boolean>(false);
const isSyncing = ref<boolean>(false);

const workingOn = ref<string | null>(null);
const showDetails = ref<string>('0');
const progress = new ProgressLogger();
const indexTracer = new IndexTracer();

/// documents and related status
const selectedDocumentIds = ref<number[]>([]);
const hasSelected = computed(() => selectedDocumentIds.value.length != 0);
const { data: documents, refresh: reloadDocuments } = useAsyncData(`documentsOfCollection#${id}`, async () => {
  return await Promise.resolve((isLoading.value = true))
    .then(() => getDocumentsByCollectionId(id))
    .catch((e) => {
      message.error(`Failed to load documents: ${errToString(e)}`);
      return null;
    })
    .finally(() => (isLoading.value = false));
});
const uiDocuments = computed(() => {
  return (
    documents.value?.map(
      (d) =>
        ({
          key: d.id,
          filename: basename(d.filepath),
          filepath: d.filepath,
          md5: d.md5Hash,
        } as DocumentUiData),
    ) || []
  );
});

/// collectionIndex and related status
const collectionStore = useCollectionStore();
const { indexesByCollectionId } = storeToRefs(collectionStore);
const index = computed(() => {
  if (indexId.value == null) {
    message.warn('No index profile selected for this collection. Please select one in the collection manage page.');
    return undefined;
  }
  const indexProfiles = indexesByCollectionId.value.get(id);
  if (!indexProfiles) {
    message.warn('No index profile for this collection. Please add in the collection manage > indexes page.');
    return undefined;
  }
  return indexProfiles.find((p) => p.id == indexId.value);
});

/// index synchronizer and related status
const indexSyncStatus = ref<IndexSyncStatus>();
watch([index, documents], computeIndexSyncStatus);
const syncStatusBrief = computed(() => {
  if (isComputingSync.value) return 'Computing...';
  if (!indexSyncStatus.value) return 'Not computed';
  return `🚀+${indexSyncStatus.value?.toIndexed.length}, -${indexSyncStatus.value?.toDeleted.length}`;
});

await Promise.resolve((isLoading.value = true))
  .then(() => collectionStore.load())
  .catch((e) => {
    message.error(`Failed to collection: ${errToString(e)}`);
  })
  .finally(() => (isLoading.value = false));

/**
 * Open a file selection dialog, and add the selected documents into the collection.
 */
async function addDocuments() {
  // Open a selection dialog, and collection documents
  const newDocuments = await open({
    multiple: true,
    filters: [
      {
        name: 'Documents',
        extensions: ['pdf', 'doc', 'md'],
      },
    ],
  });
  if (newDocuments == null) {
    return;
  }

  /**
   * Add documents to collection by inserting into database
   * After all, reload the documents list.
   *
   * @param filepaths The filepaths of the documents to add
   */
  async function addToDatabase(filepaths: string[]) {
    const documents = filepaths.map((filepath) => {
      return {
        filename: basename(filepath),
        filepath: filepath,
      } as CreateDocumentData;
    });

    const documentIds = [];
    progress.totalNum.value = documents.length;
    for (const document of documents) {
      progress.info(`Collecting ${document.filename}...`);
      workingOn.value = document.filename;
      const data = await getOrCreateDocument(document);
      documentIds.push(data.id);
      progress.advance();
    }

    return await addDocumentsToCollection(id, documentIds).then(async (added) => {
      progress.info('Reloading...');
      await reloadDocuments();
      return added;
    });
  }

  await Promise.resolve((isAdding.value = true))
    .then(async () => {
      const added = await addToDatabase(typeof newDocuments === 'string' ? [newDocuments] : newDocuments);
      message.info(`Added ${added.length} documents into collection ${id}`);
    })
    .catch((error) => {
      message.error(`Failed to add documents: ${errToString(error)}`);
    })
    .finally(() => {
      isAdding.value = false;
      progress.reset();
    });
}

/**
 * Remove a single document from the collection.
 */
async function removeDocument(key: number) {
  await removeDocuments([key]);
}

/**
 * Remove all selected documents from the collection.
 */
async function removeSelectedDocuments() {
  await removeDocuments(selectedDocumentIds.value);
  selectedDocumentIds.value = [];
}

/**
 * Remove documents from the collection.
 */
async function removeDocuments(keys: number[]) {
  const deleted = await deleteDocumentsInCollection(id, keys);
  documents.value = documents.value?.filter((e) => !keys.includes(e.id)) || null;
  message.info(`Deleted ${deleted} document(s)!`);
  return deleted;
}

async function recomputeIndexSyncStatus() {
  await computeIndexSyncStatus([index.value, documents.value]);
}

/**
 * Compute the sync status of the index.
 */
async function computeIndexSyncStatus([newIndexProfile, newDocuments]: [
  CollectionIndexWithAll | undefined,
  Document[] | null,
]) {
  if (newIndexProfile == undefined || newDocuments == null) {
    indexSyncStatus.value = undefined;
    return;
  }
  await Promise.resolve((isComputingSync.value = true))
    .then(async () => {
      return (indexSyncStatus.value = IndexSyncStatus.compute(newDocuments, newIndexProfile));
    })
    .then((status) => {
      message.info(`Computed sync status: ${status.toIndexed.length} to index, ${status.toDeleted.length} to delete.`);
    })
    .catch((e) => {
      message.error(`Failed to compute sync: ${errToString(e)}`);
    })
    .finally(() => (isComputingSync.value = false));
}

/**
 * Synchronize the index with the collection.
 */
async function syncIndex() {
  const syncStatus = indexSyncStatus.value;
  if (!syncStatus) {
    message.warn('Sync status is not ready.');
    return;
  }

  const collectionIndex = index.value;
  if (!collectionIndex) {
    message.warn('No index profile for this collection. Please specify one in the collection manage page.');
    return;
  }

  await Promise.resolve((isSyncing.value = true))
    .then(async () => {
      indexTracer.start();
      const indexer = await Indexer.create(collectionIndex, indexTracer);
      return await indexer.sync(syncStatus, collectionIndex);
    })
    .then(({ deleted, indexed }) => {
      message.info(`Indexed ${indexed} documents, deleted ${deleted} documents.`);
      // todo: refresh the collection's indexed documents
      indexTracer.finish();
    })
    .catch((e) => {
      message.error(`Failed to sync index: ${errToString(e)}`);
      console.log(e)
      indexTracer.fail();
    })
    .finally(() => (isSyncing.value = false));
}

/**
 * Callback for when a column of the table is resized.
 */
function handleResizeColumn(w: number, col: TableColumnType) {
  col.width = w;
}

/**
 * Callback for when selection of the table is changed.
 */
function onSelectionChanged(selected: number[]) {
  selectedDocumentIds.value = selected;
}
</script>
