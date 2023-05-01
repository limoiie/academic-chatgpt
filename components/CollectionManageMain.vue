<template>
  <a-space v-if="index" class="w-full" direction="vertical">
    <a-modal title="Adding..." :visible="isAdding" :closable="false">
      <TraceBar :tracer-status="addTracer" />
    </a-modal>
    <a-modal title="Syncing..." :visible="isSyncing" :closable="false" @cancel="() => (isSyncing = false)">
      <TraceBar :tracer-status="indexTracer" />
    </a-modal>
    <a-space class="w-full" direction="vertical">
      <a-space>
        <file-selector v-if="!hasSelected" :options="openOptions" @select="addDocuments"></file-selector>
        <a-button v-if="hasSelected" class="ant-btn-with-icon" @click="removeSelectedDocuments" danger>
          <template #icon>
            <DeleteOutlined />
          </template>
          Remove
        </a-button>
        <a-button v-if="!hasSelected" :loading="isLoading" shape="circle" @click="reloadDocuments">
          <template #icon>
            <ReloadOutlined />
          </template>
        </a-button>
        <a-popover :color="indexSyncStatus?.clean ? 'green' : 'orange'">
          <template #content>
            <a-space>
              {{ indexSyncStatus?.clean ? 'Synced!' : `Sync changes: ${syncStatusBrief}.` }}
              <a-tooltip title="Reload sync status" :mouse-enter-delay="1">
                <a-button
                  v-if="!hasSelected"
                  :loading="isComputingSync"
                  :disabled="isAdding || isLoading"
                  :type="'dashed'"
                  shape="circle"
                  @click="recomputeIndexSyncStatus"
                >
                  <template #icon>
                    <DiffOutlined />
                  </template>
                </a-button>
              </a-tooltip>
            </a-space>
          </template>

          <a-button
            v-if="!hasSelected"
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
        </a-popover>
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
  <a-result v-else title="No index selected">
    <template #subTitle>You may need to select an existing index or create a new one in the indexes tab.</template>
  </a-result>
</template>

<script setup lang="ts">
import { CloudSyncOutlined, DeleteOutlined, DiffOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { message, TableColumnType } from 'ant-design-vue';
import { basename } from 'pathe';
import { ref, toRefs } from 'vue';
import { CollectionIndexWithAll, Document } from '~/plugins/tauri/bindings';
import { BasicCollectionSummarizer } from '~/utils/collectionSummarizers/basic';
import { BasicDocumentLoader } from '~/utils/documentLoaders/factory';
import { IndexSyncStatus } from '~/utils/indexSyncStatus';
import { NestedStepTracer } from '~/utils/tracer';

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

const props = defineProps<{ id: number; index: CollectionIndexWithAll | undefined }>();
const { id, index } = toRefs(props);

const { $tauriCommands } = useNuxtApp();

const isLoading = ref<boolean>(false);
const isAdding = ref<boolean>(false);
const isComputingSync = ref<boolean>(false);
const isSyncing = ref<boolean>(false);

const indexTracer = new NestedStepTracer();
const addTracer = new NestedStepTracer();
const documentLoader = new BasicDocumentLoader();
const collectionSummarizer = new BasicCollectionSummarizer();

const openOptions = {
  multiple: true,
  filters: [
    {
      name: 'Documents',
      extensions: ['pdf', 'txt', 'md'],
    },
  ],
};

/// documents and related status
const selectedDocumentIds = ref<number[]>([]);
const hasSelected = computed(() => selectedDocumentIds.value.length != 0);
const { data: documents, refresh: reloadDocuments } = useAsyncData(`documentsOfCollection#${id}`, async () => {
  return await Promise.resolve((isLoading.value = true))
    .then(() => $tauriCommands.getDocumentsByCollectionId(id.value))
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
          filename: d.filename,
          filepath: d.filepath,
          md5: d.md5Hash,
        } as DocumentUiData),
    ) || []
  );
});

/// index synchronizer and related status
const indexSyncStatus = ref<IndexSyncStatus>();
watch([index, documents], (changed) => {
  computeIndexSyncStatus(changed, false);
});
const syncStatusBrief = computed(() => {
  if (isComputingSync.value) return 'Computing...';
  if (!indexSyncStatus.value) return 'Not computed';
  return `🚀+${indexSyncStatus.value?.toIndexed.length}, -${indexSyncStatus.value?.toDeleted.length}`;
});

/**
 * Add the selected documents into the collection.
 */
async function addDocuments(selected: File[] | string[] | null) {
  if (selected == null) {
    return;
  }

  /**
   * Add documents to the collection by inserting into database
   * After all, reload the document list.
   *
   * @param files The file objects or paths of the documents to add
   */
  async function addToDatabase(files: File[] | string[]) {
    addTracer.onStepStart('Adding', `${files.length} new documents...`, files.length);

    const documentIds: number[] = [];
    for (const file of files) {
      const data =
        typeof file == 'string'
          ? {
              Path: {
                filename: basename(file),
                filepath: file,
              },
            }
          : {
              File: {
                filename: file.name,
                content: Array.from(new Uint8Array(await file.arrayBuffer())),
              },
            };

      const filename = data.File ? data.File.filename : data.Path.filename;
      await Promise.resolve(() => addTracer.onStepStart(filename, '', undefined))
        .then(() => $tauriCommands.getOrCreateDocument(data))
        .then((document) => {
          documentIds.push(document.id);
        })
        .catch((error) => {
          message.error(`Failed to add document ${filename}: ${errToString(error)}`);
          return null;
        })
        .finally(() => addTracer.onStepEnd());
    }

    return await $tauriCommands.addDocumentsToCollection(id.value, documentIds).then(async (added) => {
      addTracer.log('Reloading...');
      await reloadDocuments();
      return added;
    });
  }

  await Promise.resolve((isAdding.value = true))
    .then(async () => {
      addTracer.start();
      return await addToDatabase(selected);
    })
    .then((added) => {
      addTracer.finish();
      message.info(`Added ${added.length} documents into collection ${id}`);
    })
    .catch((error) => {
      addTracer.fail();
      message.error(`Failed to add documents: ${errToString(error)}`);
    })
    .finally(() => (isAdding.value = false));
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
  const deleted = await $tauriCommands.deleteDocumentsInCollection(id.value, keys);
  documents.value = documents.value?.filter((e) => !keys.includes(e.id)) || null;
  message.info(`Deleted ${deleted} document(s)!`);
  return deleted;
}

async function recomputeIndexSyncStatus() {
  await computeIndexSyncStatus([index.value, documents.value], true);
}

/**
 * Compute the sync status of the index.
 */
async function computeIndexSyncStatus(
  [newIndexProfile, newDocuments]: [CollectionIndexWithAll | undefined, Document[] | null],
  showInfo = false,
) {
  if (newIndexProfile == undefined || newDocuments == null) {
    indexSyncStatus.value = undefined;
    return;
  }
  await Promise.resolve((isComputingSync.value = true))
    .then(async () => {
      return (indexSyncStatus.value = IndexSyncStatus.compute(newDocuments, newIndexProfile));
    })
    .then((status) => {
      showInfo
        ? status.clean
          ? message.success('Index is synced.')
          : message.info(
              `Computed sync status: ${status.toIndexed.length} to index, ${status.toDeleted.length} to delete.`,
            )
        : undefined;
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
      const indexer = await Indexer.create(collectionIndex, indexTracer, documentLoader, collectionSummarizer);
      return await indexer.sync(syncStatus, collectionIndex);
    })
    .then(({ deleted, indexed }) => {
      message.info(`Indexed ${indexed} documents, deleted ${deleted} documents.`);
      indexTracer.finish();
    })
    .catch((e) => {
      message.error(`Failed to sync index: ${errToString(e)}`);
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
