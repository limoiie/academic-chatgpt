<template>
  <div>
    <a-modal v-model:visible="isCreateEmbeddingsConfigVisible" title="Create Embedings Config">
      <CreateEmbeddingsConfig />
    </a-modal>
    <a-modal v-model:visble="isCreateIndexConfigVisible" title="CreateIndexConfig">
      <CreateIndexConfig />
    </a-modal>

    <a-space direction="vertical">
      <SelectEmbeddingsConfig class="w-full" v-model:config-id="formState.embeddingId" />
      <SelectIndexConfig class="w-full" v-model:config-id="formState.indexId" />
    </a-space>
  </div>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue';
import { Document } from 'langchain/docstore';
import { PineconeStore } from 'langchain/vectorstores';
import { integer } from 'vscode-languageserver-types';
import { reactive } from 'vue';

const { $pinecone, $openaiEmbeddings } = useNuxtApp();

const isEmbedding = ref<boolean>(false);
const isCreateEmbeddingsConfigVisible = ref<boolean>(false);
const isCreateIndexConfigVisible = ref<boolean>(false);

interface FormState {
  embeddingId: integer | undefined;
  indexId: integer | undefined;
}

const formState = reactive<FormState>({
  embeddingId: undefined,
  indexId: undefined,
});

type Key = string | number;

interface DocumentEntry {
  key: Key;
  filename: string;
  filepath: string;
  documentChunks: number;
  vectors: number;
  embedded: boolean;
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

async function embeddingSelectedDocuments(selectedDocuments: DocumentEntry[]) {
  isEmbedding.value = true;
  // const selectedDocuments = data.value.filter((e) => selectedRawKeys.value.includes(e.key));
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
