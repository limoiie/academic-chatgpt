<template>
  <a-layout>
    <a-layout-content class="mx-8 mt-2 mb-8">
      <a-divider orientation="left" orientation-margin="0">Config</a-divider>
      <a-space direction="vertical">
        <div class="w-80 flex flex-row items-baseline">
          <a-input ref="vCollectionName" v-model:value="formState.collectionName" placeholder="Collection Name" />
          <EditOutlined class="px-2" />
        </div>
      </a-space>

      <a-divider orientation="left" orientation-margin="0">Documents</a-divider>
      <a-space class="w-full" direction="vertical">
        <a-space>
          <a-button v-if="!hasSelected" @click="addDocuments">
            <template #icon>
              <PlusCircleOutlined />
            </template>
            Add more
          </a-button>
          <a-button v-if="hasSelected" @click="removeSelectedDocuments" danger>
            <template #icon>
              <ClearOutlined />
            </template>
            Remove
          </a-button>
        </a-space>
        <a-table
          v-if="formState.documents.length != 0"
          :data-source="formState.documents"
          :columns="columns"
          :row-selection="{ selectedRowKeys: selectedRawKeys, onChange: onSelectionChanged }"
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
        <a-empty
          v-else
          image="https://gw.alipayobjects.com/mdn/miniapp_social/afts/img/A*pevERLJC9v0AAAAAAAAAAABjAQAAAQ/original"
          :image-style="{ alignSelf: 'center' }"
          class="flex flex-col !p-8 !mb-4 ant-table"
        >
          <template #description>
            <span> No documents yet! </span>
          </template>
          <a-button class="m-auto" type="primary" @click="addDocuments">Add Now</a-button>
        </a-empty>
      </a-space>
      <a-button type="primary" :disabled="!isFormStateValid" :loading="isCreating" @click="addCollection">Create</a-button>
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import { createCollection } from '#imports';
import { ClearOutlined, DeleteOutlined, EditOutlined, PlusCircleOutlined } from '@ant-design/icons-vue';
import { open } from '@tauri-apps/api/dialog';
import { message } from 'ant-design-vue';
import { basename } from 'pathe';
import { onMounted, reactive, ref } from 'vue';

const vCollectionName = ref<any | null>(null);
onMounted(() => {
  vCollectionName.value.focus();
});

const selectedRawKeys = ref<Key[]>([]);
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

interface DocumentUiData {
  key: Key;
  filename: string;
  filepath: string;
  documentChunks: number;
  vectors: number;
  embedded: boolean;
}

interface FormState {
  collectionName: string;
  documents: DocumentUiData[];
}

const formState = reactive<FormState>({
  collectionName: '',
  documents: [],
});
const isFormStateValid = computed(() => {
  return formState.collectionName && formState.documents.length;
});

function onSelectionChanged(selected: Key[]) {
  selectedRawKeys.value = selected;
}

async function addCollection() {
  isCreating.value = true;
  try {
    const documents = formState.documents.map((d) => {
      return {
        filename: d.filename,
        filepath: d.filepath,
      };
    });

    const collection = await createCollection({
      documents: documents,
      name: formState.collectionName,
    });
    message.info(`New collection ${collection.name}#${collection.id}`);
    navigateTo(`/main/collections/${collection.id}`);
  } catch (e) {
    message.error(`Failed to create collection: ${e}`);
  }

  isCreating.value = false;
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
    formState.documents.push({
      key: formState.documents.length,
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
    message.info('Nothing selected');
    return;
  }
  message.info(`Selected ${newDocuments.length} files`);
}

async function removeDocuments(keys: Key[]) {
  formState.documents = formState.documents.filter((e) => !keys.includes(e.key));
}

async function removeDocument(key: Key) {
  await removeDocuments([key])
}

async function removeSelectedDocuments() {
  await removeDocuments(selectedRawKeys.value)
  selectedRawKeys.value = []
}
</script>

<style lang="sass" scoped>
.ant-divider
  font-size: 14px
  font-weight: normal
</style>
