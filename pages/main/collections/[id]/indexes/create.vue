<template>
  <a-layout class="h-full">
    <a-layout-content class="h-full flex flex-row items-center mx-8 mt-2 mb-8">
      <a-modal title="Indexing..." :visible="showProcessing" :closable="false" @cancel="cancelIndex">
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

      <div v-if="progress.status.value == 'ready'" class="w-full">
        <a-empty v-if="quickDefaultMode" class="w-full mb-24! flex flex-col items-center">
          <template #description>
            <span> No index yet </span>
          </template>
          <a-button-group>
            <a-button type="primary" @click="createIndexDefault" :loading="progress.processing.value">
              Quick Index Now
            </a-button>
            <a-button type="dashed" @click="quickDefaultMode = false">Advanced</a-button>
          </a-button-group>
        </a-empty>
        <div v-else class="w-full">
          <a-space v-if="progress.status.value == 'ready'" class="w-full" direction="vertical">
            <a-divider orientation="left" orientation-margin="0"> New Index Profile</a-divider>
            <a-form class="form" :model="formState" :label-col="{ span: 8 }">
              <a-form-item
                label="Index Profile Name"
                name="name"
                :rules="[
                  { required: true, message: 'Missing profile name.', trigger: ['blur', 'change'] },
                  {
                    validator: notInValidate(existingIndexProfileNames),
                    message: 'Name already exists',
                    trigger: ['blur', 'change'],
                  },
                ]"
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

            <a-button
              type="primary"
              @click="createIndexAdvanced"
              :loading="progress.processing.value"
              :disabled="!isFormValid"
            >
              Create
            </a-button>
            <a-button type="primary" @click="createIndexDefault" :loading="progress.processing.value">
              Quick Index Now
            </a-button>
          </a-space>
        </div>
      </div>

      <a-result
        v-if="progress.status.value == 'done'"
        class="w-full"
        status="success"
        title="Collection has been indexed successfully!"
      >
        <template #extra>
          <a-button key="console" type="primary" @click="chatNow">Chat now</a-button>
          <a-button key="create-again" @click="reset">Create again</a-button>
        </template>
      </a-result>

      <a-result v-if="progress.status.value == 'error'" class="w-full" status="error" title="Something went wrong">
        <template #extra>
          <a-button key="backward" @click="reset">Back to config</a-button>
        </template>
      </a-result>
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { reactive, ref } from 'vue';
import { stringify } from 'yaml';
import SelectOrCreateEmbeddingsClient from '~/components/SelectOrCreateEmbeddingsClient.vue';
import SelectOrCreateEmbeddingsConfig from '~/components/SelectOrCreateEmbeddingsConfig.vue';
import SelectOrCreateVectorDbConfig from '~/components/SelectOrCreateVectorDbConfig.vue';
import { useCollectionStore } from '~/store/collections';
import { useDefaultEmbeddingsStore } from '~/store/defaultEmbeddings';
import { useDefaultVectorDbStore } from '~/store/defaultVectorDb';
import { ProgressLogger } from '~/types';
import {
  CollectionIndexProfile,
  createCollectionIndexProfile,
  GetEmbeddingsClientData,
  GetEmbeddingsConfigData,
  GetVectorDbConfigData,
} from '~/utils/bindings';
import { createEmbeddings } from '~/utils/embeddings';
import { namespaceOfProfile } from '~/utils/index_profiles';
import { Indexer } from '~/utils/indexer';
import { notInValidate } from '~/utils/validates';
import { createVectorstore } from '~/utils/vectorstores';

const quickDefaultMode = ref<boolean>(true);
const workingOn = ref<string | null>(null);
const showProcessing = ref<boolean>(false);
const showDetails = ref<string>('0');
const progress = new ProgressLogger();

interface FormState {
  name: string;
  chunkOverlap: number;
  chunkSize: number;
  embeddingsClient: GetEmbeddingsClientData | undefined;
  embeddingsConfig: GetEmbeddingsConfigData | undefined;
  vectorDbConfig: GetVectorDbConfigData | undefined;
}

const formState = reactive<FormState>({
  name: 'default',
  chunkSize: 1000,
  chunkOverlap: 200,
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

const route = useRoute();
const collectionId = parseInt(route.params['id'] as string);
const collectionStores = useCollectionStore();
const { collections, indexProfilesByCollectionId } = storeToRefs(collectionStores);
collectionStores.loadFromDb();
collectionStores.loadIndexProfilesFromDb();

const indexProfile = ref<CollectionIndexProfile | null>(null);
const collection = computed(() => collections.value.find((c) => c.id == collectionId));
const indexProfiles = computed(() => indexProfilesByCollectionId.value.get(collectionId) || []);
const existingIndexProfileNames = computed(() => indexProfiles.value.map((p) => p.name));

const defaultEmbeddingsStore = useDefaultEmbeddingsStore();
const defaultVectorDbStore = useDefaultVectorDbStore();
const { defaultEmbeddingsClient, defaultEmbeddingsConfig } = storeToRefs(defaultEmbeddingsStore);
const { defaultVectorDbConfig } = storeToRefs(defaultVectorDbStore);

await defaultEmbeddingsStore.loadFromLocalStore();
await defaultVectorDbStore.loadFromLocalStore();

async function createIndexDefault() {
  if (defaultEmbeddingsClient.value.id == -1 || defaultEmbeddingsConfig.value.id == -1) {
    message.error(`Failed to create default index: no default presets for embeddings`);
    return;
  }

  await createIndex(
    formState.name,
    formState.chunkOverlap,
    formState.chunkSize,
    defaultEmbeddingsConfig.value,
    defaultEmbeddingsClient.value,
    defaultVectorDbConfig.value,
  );
}

async function createIndexAdvanced() {
  const { embeddingsConfig, vectorDbConfig, embeddingsClient } = formState;
  if (!isFormValid.value) {
    progress.fail();
    showProcessing.value = false;
    message.error(`Failed to create advanced index: invalid form data.`);
    return;
  }

  await createIndex(
    formState.name,
    formState.chunkOverlap,
    formState.chunkSize,
    embeddingsConfig!,
    embeddingsClient!,
    vectorDbConfig!,
  );
}

async function createIndex(
  name: string,
  chunkOverlap: number,
  chunkSize: number,
  embeddingsConfig: GetEmbeddingsConfigData,
  embeddingsClient: GetEmbeddingsClientData,
  vectorDbConfig: GetVectorDbConfigData,
) {
  progress.start();
  showProcessing.value = true;
  indexProfile.value = null;

  await nextTick(async () => {
    try {
      progress.info('fetch documents of collection...');
      const documents = await getDocumentsByCollectionId(collectionId);
      progress.totalNum.value = documents.length;

      const splitting = await getOrCreateSplitting({
        chunk_overlap: chunkOverlap,
        chunk_size: chunkSize,
      });
      indexProfile.value = await createCollectionIndexProfile({
        name: name,
        splitting_id: splitting.id,
        collection_id: collectionId,
        embeddings_config_id: embeddingsConfig.id,
        vector_db_config_id: vectorDbConfig.id,
      });

      const namespace = namespaceOfProfile(indexProfile.value);
      const embeddings = await createEmbeddings(embeddingsClient, embeddingsConfig);
      const vectorstore = await createVectorstore(vectorDbConfig, embeddings, namespace);
      const indexer = new Indexer(embeddings, vectorstore, embeddingsConfig.id, splitting, (...messages: any[]) => {
        progress.info(messages.map((e) => e.toString()).join(' '));
      });

      progress.info('start processing...');
      for await (const document of indexer.indexDocuments(...documents)) {
        workingOn.value = document.filename;
        progress.advance({ level: 'info', message: `processing document ${document.filename}` });
      }
      progress.info('done...');

      progress.finish();
      showProcessing.value = false;
    } catch (e: any) {
      if (indexProfile.value) {
        progress.info(`Cleaning indexProfile ${indexProfile.value?.id}`);
        await deleteIndexProfilesById([indexProfile.value?.id]).catch((e) =>
          progress.error(`Failed to clean: ${e.toString()}`),
        );
      }
      progress.error(`Failed to index: ${stringify(e)} ${e.toString()}`);
      progress.fail();
    }
  });

  await collectionStores.reloadCollectionById(collectionId);
}

async function cancelIndex() {
  showProcessing.value = false;
}

async function chatNow() {
  if (indexProfile.value) {
    const url = route.path.replace(/\/create/, `/${indexProfile.value.id}`);
    navigateTo(url);
  }
}

async function reset() {
  workingOn.value = null;
  showProcessing.value = false;
  progress.reset();
}
</script>

<style lang="sass">
.form
  max-width: 600px

.ant-collapse
  .ant-collapse-item
    .ant-collapse-header
      padding: 0
</style>
