<!--suppress VueUnrecognizedSlot -->
<template>
  <a-layout id="main" class="!min-h-screen">
    <!--suppress TypeScriptValidateTypes -->
    <a-layout-sider
      id="sider"
      class="flex flex-col"
      :theme="$colorMode.value"
      v-model:collapsed="collapsed"
      collapsible
    >
      <div id="settings" class="flex-auto">
        <a-menu
          mode="inline"
          :theme="$colorMode.value"
          v-model:selectedKeys="selectedKeys"
          @click="handleMenuClick"
          @focusout="handleMenuBlur"
        >
          <a-sub-menu key="theme">
            <template #icon>
              <BgColorsOutlined />
            </template>
            <template #title> On {{ upperFirst($colorMode.value) }} Theme</template>
            <a-menu-item v-for="key of ['light', 'dark', 'system']" :key="key">
              {{ key }}
              <template #icon v-if="$colorMode.preference == key">
                <CheckOutlined />
              </template>
            </a-menu-item>
          </a-sub-menu>
          <a-menu-item key="upload" @click="uploadFiles">
            Upload Files
            <template #icon>
              <UploadOutlined />
            </template>
          </a-menu-item>
          <a-menu-item key="newDocumentsCollection" @click="newDocumentsCollection">
            New Documents Collection
            <template #icon>
              <FileAddOutlined />
            </template>
          </a-menu-item>
        </a-menu>
      </div>
    </a-layout-sider>
    <a-layout-content>
      <NuxtPage />
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import { BgColorsOutlined, CheckOutlined, FileAddOutlined, UploadOutlined } from '@ant-design/icons-vue';
import { open } from '@tauri-apps/api/dialog';
import { WebviewWindow } from '@tauri-apps/api/window';
import { notification } from 'ant-design-vue';
import { PineconeStore } from 'langchain/vectorstores';
import { upperFirst } from 'scule';
import { PDFBytesLoader } from '~/utils/documents_loaders';

// noinspection JSUnusedGlobalSymbols
const { $pinecone, $openaiEmbeddings } = useNuxtApp();

const colorMode = useColorMode();
const collapsed = ref<boolean>(false);
const selectedKeys = ref([]);

async function uploadFiles() {
  // Open a selection dialog
  const selected = await open({
    multiple: true,
    filters: [
      {
        name: 'Documents',
        extensions: ['pdf', 'doc'],
      },
    ],
  });

  notification.open({
    message: 'Selected Files',
    description: `These are selected files: ${selected}`,
    onClick: () => {
      console.log('Notification Clicked!');
    },
  });

  async function process_one_file(filePath: string) {
    // load pdf and split into documents
    const loader = new PDFBytesLoader(filePath);
    const docs = await loader.loadAndSplit();
    for (const doc of docs) {
      console.log(doc.metadata);
    }

    notification.open({
      message: 'Splitting PDF files',
      description: `Total Documents: ${docs.length}`,
      onClick: () => {
        console.log('Notification Clicked!');
      },
    });

    // embedding documents
    const pineconeIndexName = 'test-index';
    const pineconeNamespace = 'debug-dojo';
    const index = $pinecone.Index(pineconeIndexName);

    //embed the PDF documents
    await PineconeStore.fromDocuments(docs, $openaiEmbeddings, {
      pineconeIndex: index,
      namespace: pineconeNamespace,
      textKey: 'text',
    });

    notification.open({
      message: 'Vectorized done',
      description: 'All the documents have been embedded and uploaded to the pinecone.',
    });
  }

  if (typeof selected === 'string') {
    await process_one_file(selected);
  } else if (selected instanceof Array) {
    for (const filePath of selected) {
      await process_one_file(filePath);
    }
  }
}

async function newDocumentsCollection() {
  const webview = new WebviewWindow('manageWindow', {
    url: 'manage/collections/create',
  });

  // since the webview window is created asynchronously,
  // Tauri emits the `tauri://created` and `tauri://error` to notify you of the creation response
  await webview.once('tauri://created', function () {
    console.log('webview window successfully created');
  });
  await webview.once('tauri://error', function (e) {
    console.log(`an error occurred during webview window creation: ${e}`);
  });

  await webview.show();
}

function handleMenuBlur() {
  selectedKeys.value = [];
}

function handleMenuClick(e: { key: string; keyPath: string[] }) {
  switch (e.keyPath[0]) {
    case 'theme':
      colorMode.preference = e.key;
      break;
  }
}
</script>

<style scoped></style>
