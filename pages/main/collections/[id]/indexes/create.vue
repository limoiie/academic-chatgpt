<template>
  <a-layout class="h-full">
    <a-layout-content class="h-full flex flex-row items-center mx-8 mt-2 mb-8">
      <a-modal title="Indexing..." :visible="showProcessing" :closable="false" @cancel="cancelIndex">
        <a-space class="w-full" direction="vertical">
          <a-progress :percent="progress.percentage.value" />
          <p class="whitespace-nowrap overflow-scroll">{{ progress.inlineMessage.value }}</p>
          <LogConsole :logs="progress.logs.value" />
        </a-space>
      </a-modal>

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
        </a-space>

        <a-result
          v-else-if="progress.status.value == 'done'"
          status="success"
          title="Collection has been indexed successfully!"
        >
          <template #extra>
            <a-button key="console" type="primary">Go Console</a-button>
            <a-button key="buy" @click="reset">Create again</a-button>
          </template>
        </a-result>

        <a-result v-else-if="progress.status.value == 'error'" status="error" title="Something went wrong">
          <template #extra>
            <a-button key="console" type="primary">Go Console</a-button>
            <a-button key="buy" @click="reset">Create again</a-button>
          </template>
        </a-result>
      </div>
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
import { useDefaultAIStore } from '~/store/defaultAI';
import { useDefaultVectorDbStore } from '~/store/defaultVectorDb';
import { ProgressLogger } from '~/types';
import {
  CollectionIndexProfile,
  createCollectionIndexProfile,
  GetEmbeddingsClientData,
  getEmbeddingsClients,
  GetEmbeddingsConfigData,
  GetVectorDbConfigData,
  getVectorDbConfigs,
} from '~/utils/bindings';
import { createEmbeddings } from '~/utils/embeddings';
import { namespaceOfProfile } from '~/utils/index_profiles';
import { Indexer } from '~/utils/indexer';
import { notInValidate } from '~/utils/validates';
import { createVectorstore } from '~/utils/vectorstores';

const quickDefaultMode = ref<boolean>(true);
const showProcessing = ref<boolean>(false);
const progress = new ProgressLogger();

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
  name: 'default',
  chunkSize: 1000,
  chunkOverlap: 200,
  collectionId: parseInt(useRoute().params['id'] as string),
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

const { data } = useAsyncData('currentCollection', async () => {
  const collection = await getCollectionById(formState.collectionId);
  if (collection == null) {
    message.error(`No such collection with id: ${formState.collectionId}`);
    navigateTo('/main/collections');
  }
  const indexProfiles = await getIndexProfilesByCollectionId(formState.collectionId);
  return { collection, indexProfiles };
});
const existingIndexProfileNames = computed(() => {
  return data.value?.indexProfiles.map((p) => p.name);
});

const defaultAIStore = useDefaultAIStore();
const defaultVectorDbStore = useDefaultVectorDbStore();

await defaultAIStore.loadFromLocalStore();
await defaultVectorDbStore.loadFromLocalStore();

const { defaultAIApiKey, defaultAIClient, defaultAIModel } = storeToRefs(defaultAIStore);
const { defaultVectorDbClient, defaultVectorDbApiKey, defaultVectorDbMeta } = storeToRefs(defaultVectorDbStore);

async function prepareDefaultEmbeddingsConfig() {
  if (!defaultAIClient.value || !defaultAIModel.value || !defaultAIApiKey.value) {
    return;
  }

  const clients = await getEmbeddingsClients();
  let client = clients.find((client) => {
    return client.type == defaultAIClient.value && client.info.apiKey == defaultAIApiKey.value;
  });
  if (!client) {
    client = await createEmbeddingsClient({
      type: defaultAIClient.value,
      name: defaultAIClient.value + '-default',
      info: {
        apiKey: defaultAIApiKey.value,
      },
    });
  }

  const configs = await getEmbeddingsConfigsByClientType(client.type);
  let config = configs.find((config) => {
    return config.meta.model == defaultAIModel.value;
  });
  if (!config) {
    config = await createEmbeddingsConfig({
      name: client.type + '-' + defaultAIModel.value,
      client_type: client.type,
      meta: {
        model: defaultAIModel.value,
      },
    });
  }

  return { client, config };
}

async function prepareDefaultVectorDbConfig() {
  if (!defaultVectorDbClient.value || !defaultVectorDbApiKey.value || !defaultVectorDbMeta.value) {
    return;
  }

  const meta = {
    apiKey: defaultVectorDbApiKey.value,
    ...defaultVectorDbMeta.value,
  };

  const configs = await getVectorDbConfigs();
  let config = configs.find((config) => {
    return config.client == defaultVectorDbClient.value && config.meta == meta;
  });
  if (!config) {
    config = await createVectorDbConfig({
      name: defaultVectorDbClient.value + '-default',
      client: defaultVectorDbClient.value,
      meta: meta,
    });
  }
  return { config };
}

async function createIndexDefault() {
  const defaultEmbeddingsData = await prepareDefaultEmbeddingsConfig();
  const defaultVectorDbData = await prepareDefaultVectorDbConfig();
  if (!defaultEmbeddingsData || !defaultVectorDbData) {
    message.error(`Failed to create default index: default presets not found`);
    return;
  }
  const { config: aiEmbeddingsConfig, client: aiEmbeddingsClient } = defaultEmbeddingsData;
  const { config: vectorDbConfig } = defaultVectorDbData;

  await createIndex(
    formState.name,
    formState.chunkOverlap,
    formState.chunkSize,
    aiEmbeddingsConfig,
    aiEmbeddingsClient,
    vectorDbConfig,
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

  let indexProfile: CollectionIndexProfile | null = null;

  await nextTick(async () => {
    try {
      progress.info('fetch documents of collection...');
      const documents = await getDocumentsByCollectionId(formState.collectionId);
      progress.totalNum.value = documents.length;

      const splitting = await getOrCreateSplitting({
        chunk_overlap: chunkOverlap,
        chunk_size: chunkSize,
      });
      indexProfile = await createCollectionIndexProfile({
        name: name,
        splitting_id: splitting.id,
        collection_id: formState.collectionId,
        embeddings_config_id: embeddingsConfig.id,
        vector_db_config_id: vectorDbConfig.id,
      });

      const namespace = namespaceOfProfile(indexProfile);
      const embeddings = await createEmbeddings(embeddingsClient, embeddingsConfig);
      const vectorstore = await createVectorstore(vectorDbConfig, embeddings, namespace);
      const indexer = new Indexer(embeddings, vectorstore, embeddingsConfig.id, splitting);

      progress.info('start processing...');
      for await (const document of indexer.indexDocuments(...documents)) {
        progress.advance({ level: 'info', message: `processing document ${document.filename}` });
      }
      progress.info('done...');

      progress.finish();
      showProcessing.value = false;
    } catch (e: any) {
      if (indexProfile) {
        progress.info(`Cleaning indexProfile ${indexProfile.id}`);
        await deleteIndexProfilesById([indexProfile?.id]).catch((e) =>
          progress.error(`Failed to clean: ${e.toString()}`),
        );
      }
      progress.error(`Failed to index: ${stringify(e)} ${e.toString()}`);
      progress.fail();
    }
  });
}

async function cancelIndex() {
  showProcessing.value = false;
}

async function reset() {
  showProcessing.value = false;
  progress.reset();
}
</script>

<style lang="sass">
.form
  max-width: 600px
</style>
