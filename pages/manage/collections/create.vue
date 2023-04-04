<template>
  <a-layout class="h-full">
    <a-layout-header>New Collection</a-layout-header>
    <a-layout-content class="mx-8 mt-2">
      <a-divider orientation="left" orientation-margin="0">Name</a-divider>
      <div class="w-80 mb-4">
        <div class="flex flex-row items-baseline" v-if="editCollectionName != null">
          <a-input
            v-model:value="editCollectionName"
            class="h-10"
            placeholder="Collection Name"
            @pressEnter="onCollectionNameChanged"
          />
          <CheckOutlined class="px-2" @click="onCollectionNameChanged" />
        </div>
        <div v-else class="flex flex-row items-baseline">
          <a-input v-model:value="collectionName" class="h-10" placeholder="Collection Name" :disabled="true" />
          <EditOutlined class="px-2" @click="onEditCollectionName" />
        </div>
      </div>
      <a-divider orientation="left" orientation-margin="0">Documents</a-divider>
      <a-space class="w-full" direction="vertical">
        <a-space id="topButtonBar">
          <a-button v-if="!hasSelected" @click="addDocuments">
            <template #icon>
              <PlusCircleOutlined />
            </template>
            Add more
          </a-button>
          <a-button v-if="hasSelected" @click="embeddingSelectedDocuments" :loading="isEmbedding">
            <template #icon>
              <NodeIndexOutlined />
            </template>
            Embedded
          </a-button>
          <a-button v-if="hasSelected" @click="clearSelectedDocuments" danger>
            <template #icon>
              <ClearOutlined />
            </template>
            Clear
          </a-button>
        </a-space>
        <a-table
          v-if="data.length != 0"
          :row-selection="{ selectedRowKeys: selectedRawKeys.value, onChange: onSelectionChanged }"
          :columns="columns"
          :data-source="data"
        >
          <template #headerCell="{ column }">
            <template v-if="column.key === 'filename'">
              <span> Filename </span>
            </template>
          </template>

          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'action'">
              <a-space>
                <a-button
                  v-if="!record.embedded"
                  @click="embeddingOneDocument(record.filepath)"
                  size="small"
                  shape="circle"
                >
                  <template #icon>
                    <NodeIndexOutlined />
                  </template>
                </a-button>
                <a-button size="small" shape="circle" danger>
                  <template #icon>
                    <DeleteOutlined />
                  </template>
                </a-button>
              </a-space>
            </template>
          </template>
        </a-table>
        <a-empty
          v-else
          image="https://gw.alipayobjects.com/mdn/miniapp_social/afts/img/A*pevERLJC9v0AAAAAAAAAAABjAQAAAQ/original"
          :image-style="{
            alignSelf: 'center',
            height: '60px',
          }"
          class="flex flex-col !p-8 ant-table"
        >
          <template #description>
            <span> No documents yet! </span>
          </template>
          <a-button type="primary" @click="addDocuments">Add Now</a-button>
        </a-empty>
      </a-space>
      <a-button type="primary" class="mt-6" @click="onCreate" :loading="isCreating">Create</a-button>
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import {
  CheckOutlined,
  ClearOutlined,
  DeleteOutlined,
  EditOutlined,
  NodeIndexOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons-vue';
import { open } from '@tauri-apps/api/dialog';
import { message, notification } from 'ant-design-vue';
import { Document } from 'langchain/docstore';
import { PineconeStore } from 'langchain/vectorstores';
import { basename } from 'pathe';
import { Ref } from 'vue';

// noinspection JSUnusedGlobalSymbols
const { $pinecone, $openaiEmbeddings } = useNuxtApp();

const collectionName = ref<string>('Todo Collection');
const editCollectionName = ref<string | undefined>(collectionName.value);

const selectedRawKeys = ref<Key[]>([]);
const isEmbedding = ref<boolean>(false);
const isCreating = ref<boolean>(false);
const hasSelected = computed(() => selectedRawKeys.value.length != 0);

const columns = [
  {
    title: 'Filename',
    dataIndex: 'filename',
    key: 'filename',
    ellipsis: true,
    width: 180,
    fixed: 'left' as 'left',
  },
  {
    title: 'Filepath',
    dataIndex: 'filepath',
    key: 'filepath',
    ellipsis: true,
  },
  {
    title: 'Action',
    key: 'action',
    width: 120,
    fixed: 'right' as 'right',
  },
];

type Key = string | number;

interface DocumentEntry {
  key: Key;
  filename: string;
  filepath: string;
  documentChunks: number;
  vectors: number;
  embedded: boolean;
}

const data: Ref<DocumentEntry[]> = ref([]);

function onSelectionChanged(selected: Key[]) {
  selectedRawKeys.value = selected;
}

function onCollectionNameChanged() {
  if (editCollectionName.value != null) {
    collectionName.value = editCollectionName.value;
  }
  editCollectionName.value = undefined;
}

function onEditCollectionName() {
  editCollectionName.value = collectionName.value;
}

function onCreate() {
  isCreating.value = true;
  /// todo: create the collection, embedding them
}

async function addDocuments() {
  // Open a selection dialog
  const newDocuments = await open({
    multiple: true,
    filters: [
      {
        name: 'Documents',
        extensions: ['pdf', 'doc', 'md'],
      },
    ],
  });

  async function addOneDocument(doc: string) {
    data.value.push({
      key: '#todo', // todo
      filename: basename(doc),
      filepath: doc,
      documentChunks: 0,
      vectors: 0,
      embedded: false,
    });
  }

  if (typeof newDocuments === 'string') {
    await addOneDocument(newDocuments);
  } else if (newDocuments instanceof Array) {
    for (const document of newDocuments) {
      await addOneDocument(document);
    }
  } else {
    notification.open({
      message: 'Nothing selected',
      description: 'Canceled',
    });

    return;
  }

  notification.open({
    message: 'Selected Files',
    description: `These are selected files: ${newDocuments}`,
    onClick: () => {
      console.log('Notification Clicked!');
    },
  });
}

async function clearSelectedDocuments() {
  data.value = data.value.filter((e) => !selectedRawKeys.value.includes(e.key));
}

async function embeddingSplitDocuments(docs: Document[]) {
  // embedding documents
  const pineconeIndexName = 'test-index';
  const pineconeNamespace = 'debug-dojo';
  const index = $pinecone.Index(pineconeIndexName);

  // 1. embedding
  const vectors = await $openaiEmbeddings.embedDocuments(docs.map(({ pageContent }) => pageContent));
  // 2. create vector db store
  const instance = new PineconeStore($openaiEmbeddings, {
    pineconeIndex: index,
    namespace: pineconeNamespace,
    textKey: 'text',
  });
  // 3. add embedding to vector database
  await instance.addVectors(vectors, docs);
}

async function embeddingSelectedDocuments() {
  isEmbedding.value = true;
  const selectedDocuments = data.value.filter((e) => selectedRawKeys.value.includes(e.key));
  for (const entry of selectedDocuments) {
    // load pdf and split into documents
    const loader = new PDFBytesLoader(entry.filepath);
    const docs = await loader.loadAndSplit();
    await embeddingSplitDocuments(docs);
  }
  isEmbedding.value = false;
}

async function embeddingOneDocument(filePath: string) {
  isEmbedding.value = true;
  try {
    // load pdf and split into documents
    const loader = new PDFBytesLoader(filePath);
    const docs = await loader.loadAndSplit();
    await embeddingSplitDocuments(docs);
  } catch (e) {
    message.error(`Failed to embedding document ${filePath}: ${e}`);
  }
  isEmbedding.value = false;
}
</script>

<style lang="sass" scoped>
#topButtonBar .ant-btn
  display: flex
  align-items: baseline

.ant-divider
  font-size: 14px
  font-weight: normal
</style>
