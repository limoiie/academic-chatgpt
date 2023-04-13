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
      </a-space>
      <a-table
        :data-source="formState.documents"
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
    <!--<a-button type="primary" :disabled="!isFormStateValid" :loading="isCreating" @click="addCollection">-->
    <!--  Create-->
    <!--</a-button>-->
  </a-space>
</template>

<script setup lang="ts">
import { ClearOutlined, DeleteOutlined, PlusCircleOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { open } from '@tauri-apps/api/dialog';
import { message, TableColumnType } from 'ant-design-vue';
import { basename } from 'pathe';
import { reactive, ref } from 'vue';
import { ProgressLogger } from '~/types';
import { CreateDocumentData, deleteDocumentsInCollection, getOrCreateDocument } from '~/utils/bindings';

const { id } = defineProps<{ id: number }>();

const isLoading = ref<boolean>(false);
const isAdding = ref<boolean>(false);
const workingOn = ref<string | null>(null);
const showDetails = ref<string>('0');
const progress = new ProgressLogger();

const selectedDocumentIds = ref<number[]>([]);
const hasSelected = computed(() => selectedDocumentIds.value.length != 0);

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

interface FormState {
  documents: DocumentUiData[];
}

const formState = reactive<FormState>({
  documents: [],
});

await reloadDocuments().catch((e) => {
  message.error(`Failed to load documents: ${errToString(e)}`);
});

function onSelectionChanged(selected: number[]) {
  selectedDocumentIds.value = selected;
}

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

  async function addToDb(filepaths: string[]) {
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

  isAdding.value = true;

  await addToDb(typeof newDocuments === 'string' ? [newDocuments] : newDocuments)
    .then((added) => {
      message.info(`Added ${added.length} documents into collection ${id}`);
    })
    .catch((e) => {
      message.error(`Failed to add documents: ${errToString(e)}`);
    })
    .finally(() => {
      isAdding.value = false;
      progress.reset();
    });
}

async function removeDocuments(keys: number[]) {
  const deleted = await deleteDocumentsInCollection(id, keys);
  formState.documents = formState.documents.filter((e) => !keys.includes(e.key));
  message.info(`Deleted ${deleted} document(s)!`);
  return deleted;
}

async function removeDocument(key: number) {
  await removeDocuments([key]);
}

async function removeSelectedDocuments() {
  await removeDocuments(selectedDocumentIds.value);
  selectedDocumentIds.value = [];
}

async function reloadDocuments() {
  isLoading.value = true;
  const documents = await getDocumentsByCollectionId(id);
  formState.documents = documents.map((doc) => {
    return {
      key: doc.id,
      filename: doc.filename,
      filepath: doc.filepath,
      md5: doc.md5Hash,
    };
  });
  isLoading.value = false;
}

function handleResizeColumn(w: number, col: TableColumnType) {
  col.width = w;
}
</script>
