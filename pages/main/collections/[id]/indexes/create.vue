<template>
  <a-layout>
    <a-layout-content class="mx-8 mt-2 mb-8">
      <a-space v-if="step == 'config'" class="w-full" direction="vertical">
        <a-divider orientation="left" orientation-margin="0"> New Index Profile</a-divider>
        <a-form class="form" :model="formState" v-bind="formItemLayout">
          <a-form-item
            label="Index Profile Name"
            name="name"
            :rules="[{ required: true, message: 'Missing profile name.' }]"
          >
            <a-input v-model:value="formState.name" />
          </a-form-item>
          <a-form-item label="Chunk Size / Overlap">
            <a-input-group>
              <a-input-number v-model:value="formState.chunkSize" />
              <span> / </span>
              <a-input-number v-model:value="formState.chunkOverlap" />
            </a-input-group>
          </a-form-item>
          <a-form-item label="Embeddings Client">
            <SelectOrCreateEmbeddingsClient class="flex" v-model:value="formState.embeddingsClient" />
          </a-form-item>
          <a-form-item label="Embeddings Config">
            <SelectOrCreateEmbeddingsConfig
              class="flex"
              :client-type="formState.embeddingsClient?.type"
              v-model:value="formState.embeddingsConfig"
            />
          </a-form-item>
          <a-form-item label="Vector Db Config">
            <SelectOrCreateVectorDbConfig class="flex" v-model:value="formState.vectorDbConfig" />
          </a-form-item>
        </a-form>

        <a-button type="primary" @click="onCreate" :loading="step == 'processing'" :disabled="!isFormValid"
          >Create
        </a-button>
        <pre>{{ stringify(formState.embeddingsClient) }}</pre>
        <pre>{{ stringify(formState.embeddingsConfig) }}</pre>
        <pre>{{ stringify(formState.vectorDbConfig) }}</pre>
      </a-space>

      <a-space v-else-if="step == 'process'" class="w-full" direction="vertical">
        <a-divider orientation="left" orientation-margin="0"> Processing...</a-divider>
        <a-progress :percent="progressPercent"></a-progress>
      </a-space>

      <a-result v-else-if="step == 'done'" status="success" title="Collection has been indexed successfully!">
        <template #extra>
          <a-button key="console" type="primary">Go Console</a-button>
          <a-button key="buy" @click="reset">Create again</a-button>
        </template>
      </a-result>

      <a-result v-else-if="step == 'error'" status="error" title="Something went wrong">
        <template #extra>
          <a-button key="console" type="primary">Go Console</a-button>
          <a-button key="buy" @click="reset">Create again</a-button>
        </template>
      </a-result>

      <LogConsole v-if="hasLogs" :logs="logger.logs.value" class="h-60 overflow-scroll" />
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import { sleep } from '@antfu/utils';
import { message } from 'ant-design-vue';
import { Embeddings } from 'langchain/embeddings';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { VectorStore } from 'langchain/vectorstores';
import { reactive, ref } from 'vue';
import { stringify } from 'yaml';
import SelectOrCreateEmbeddingsClient from '~/components/SelectOrCreateEmbeddingsClient.vue';
import SelectOrCreateEmbeddingsConfig from '~/components/SelectOrCreateEmbeddingsConfig.vue';
import SelectOrCreateVectorDbConfig from '~/components/SelectOrCreateVectorDbConfig.vue';
import { Logger } from '~/types';
import {
  createCollectionIndexProfile,
  Document,
  DocumentChunk,
  GetDocumentChunkData,
  GetEmbeddingsClientData,
  GetEmbeddingsConfigData,
  GetVectorDbConfigData,
  Splitting,
} from '~/utils/bindings';
import { dbDocumentChunk2Ui, uiDocumentChunks2Db } from '~/utils/db';
import { createEmbeddings } from '~/utils/embeddings';
import { namespaceOfProfile } from '~/utils/index_profiles';
import { createVectorstore } from '~/utils/vectorstores';

// noinspection JSUnusedGlobalSymbols
const { $pinecone, $openaiEmbeddings } = useNuxtApp();
const route = useRoute();

const step = ref<'config' | 'process' | 'done' | 'error'>('config');
const progressPercent = ref<number>(0);

const logger = new Logger(ref([]));
const hasLogs = computed(() => {
  return logger.logs.value.length > 0;
});

const formItemLayout = {
  labelCol: {
    xs: { span: 16 },
    sm: { span: 6 },
  },
  wrapperCol: {
    xs: { span: 24 },
    sm: { span: 16 },
  },
};

interface FormState {
  name: string;
  chunkOverlap: number;
  chunkSize: number;
  collectionId: number;
  embeddingsClient: GetEmbeddingsClientData | undefined;
  embeddingsConfig: GetEmbeddingsConfigData | undefined;
  vectorDbConfig: GetVectorDbConfigData | undefined;
}

const formState = reactive<FormState>({
  name: '',
  chunkSize: 1000,
  chunkOverlap: 200,
  collectionId: parseInt(route.params['id'] as string),
  embeddingsClient: undefined,
  embeddingsConfig: undefined,
  vectorDbConfig: undefined,
});
const isFormValid = computed(() => {
  return (
    formState.chunkSize > formState.chunkOverlap &&
    formState.chunkOverlap > 0 &&
    formState.vectorDbConfig != undefined &&
    formState.embeddingsConfig != undefined &&
    formState.embeddingsClient != undefined &&
    formState.name
  );
});

const { data: currentCollection } = useAsyncData('currentCollection', async () => {
  const data = await getCollectionById(formState.collectionId);
  if (data == null) {
    message.error(`No such collection with id: ${formState.collectionId}`);
  }
  return data;
});

async function splitDocuments(document: Document) {
  // todo: choose different loader according to the document type
  const loader = new PDFBytesLoader(document.filepath);
  return await loader.loadAndSplit(
    new RecursiveCharacterTextSplitter({
      chunkOverlap: formState.chunkOverlap,
      chunkSize: formState.chunkSize,
    }),
  );
}

class Indexer {
  embeddings: Embeddings;
  vectorstore: VectorStore;
  splitting: Splitting;

  constructor(embeddings: Embeddings, vectorstore: VectorStore, splitting: Splitting) {
    this.embeddings = embeddings;
    this.vectorstore = vectorstore;
    this.splitting = splitting;
  }

  async indexOneDocument(document: Document) {
    const doc_splitting = {
      document_id: document.id,
      splitting: { Id: this.splitting.id },
    } as GetDocumentChunkData;

    // fetch documents chunks first
    const notIndexedChunks = [];
    logger.info('try loading chunks from database...');
    const chunks = await getDocumentChunks(doc_splitting);
    if (chunks && chunks.length > 0) {
      logger.info(`  loaded ${chunks.length} chunks`);
      notIndexedChunks.push(...(await this.filterIndexedChunks(chunks)).map(dbDocumentChunk2Ui));
    } else {
      logger.info(`  not found, try splitting...`);
      notIndexedChunks.push(...(await splitDocuments(document)));
      logger.info(`  storing ${notIndexedChunks.length} chunks into db...`);
      // stores chunks into db
      await createChunksByDocument({
        chunks: notIndexedChunks.map(uiDocumentChunks2Db),
        data: doc_splitting,
      });
      logger.info(`  done`);
    }

    return;

    // 1. embedding
    const vectors = await this.embeddings.embedDocuments(notIndexedChunks.map((c) => c.pageContent));
    // todo: vectors store into db

    // 2. add embedding to vector database
    await this.vectorstore.addVectors(vectors, notIndexedChunks);
  }

  async filterIndexedChunks(chunks: DocumentChunk[]) {
    // todo: if in vector database, skip
    // todo: if in local database, upload and skip
    return chunks;
  }
}

async function onCreate() {
  step.value = 'process';

  const { name, chunkOverlap, chunkSize, embeddingsConfig, vectorDbConfig, embeddingsClient } = formState;
  const colConfig = currentCollection.value;

  if (
    embeddingsClient == undefined ||
    embeddingsConfig == undefined ||
    vectorDbConfig == undefined ||
    colConfig == null
  ) {
    step.value = 'error';
    message.error(`Failed to index: runtime error.`);
    return;
  }

  await nextTick(async () => {
    try {
      logger.info('fetch documents of collection...');
      const documents = await getDocumentsByCollectionId(formState.collectionId);
      logger.info(`  fetched ${documents.length} documents`);
      if (documents.length == 0) {
        return;
      }
      const splitting = await getOrCreateSplitting({
        chunk_overlap: chunkOverlap,
        chunk_size: chunkSize,
      });
      const profile = await createCollectionIndexProfile({
        name: name,
        splitting_id: splitting.id,
        collection_id: colConfig.id,
        embeddings_config_id: embeddingsConfig.id,
        vector_db_config_id: vectorDbConfig.id,
      });

      const namespace = namespaceOfProfile(profile);
      const embeddings = await createEmbeddings(embeddingsClient, embeddingsConfig);
      const vectorstore = await createVectorstore(vectorDbConfig, embeddings, namespace);
      const indexer = new Indexer(embeddings, vectorstore, splitting);

      logger.info('start processing...');

      progressPercent.value = 0;
      const progressStep = 100 / documents.length;
      for (const document of documents) {
        logger.info(`processing document ${document.filename}`);
        await indexer.indexOneDocument(document);
        progressPercent.value += progressStep;
      }
      progressPercent.value = 100;
      await sleep(1000);

      step.value = 'done';
    } catch (e) {
      logger.error(`Failed to index: ${stringify(e)}`);
      step.value = 'error';
    }
  });
}

async function reset() {
  step.value = 'config';
  progressPercent.value = 0;
  logger.reset();
}
</script>

<style lang="sass">
.form
  max-width: 600px
</style>
