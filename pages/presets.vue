<template>
  <a-card class="w-fit m-auto! mt-20!" hoverable title="Presets">
    <a-space direction="vertical" size="middle" class="w-full h-full">
      <div class="flex flex-col">
        <!--<a-divider orientation="left" orientation-margin="0">AI</a-divider>-->
        <a-input-group compact>
          <a-select v-model:value="defaultCompleteConfig.client" class="w-24 flex" :options="defaultClientOptions" />
          <a-select
            v-model:value="defaultCompleteConfig.meta.model"
            class="w-45 flex"
            :options="defaultModelOptions[defaultCompleteConfig.client]"
          />
          <a-input v-model:value="defaultCompleteConfig.meta.apiKey" class="w-64!" placeholder="Api Key" />
        </a-input-group>
      </div>
      <div class="flex flex-col">
        <!--<a-divider orientation="left" orientation-margin="0">Vector Database</a-divider>-->
        <a-input-group compact>
          <a-select v-model:value="defaultVectorDbConfig.client" class="w-26" :options="defaultVectorDbClientOptions" />
          <a-input v-model:value="defaultVectorDbConfig.meta.apiKey" class="w-64!" placeholder="Api Key" />
          <a-input v-model:value="defaultVectorDbConfig.meta.environment" class="w-32!" placeholder="Environment" />
          <a-input v-model:value="defaultVectorDbConfig.meta.indexName" class="w-32!" placeholder="Index Name" />
        </a-input-group>
      </div>
      <div class="flex flex-row">
        <div class="flex flex-grow" />
        <a-button :disabled="!isFormValid" type="primary" @click="go">Go</a-button>
      </div>
    </a-space>
  </a-card>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { allCompleteClients, allOpenAIModels, useDefaultCompleteStore } from '~/store/defaultComplete';
import { useDefaultEmbeddingsStore } from '~/store/defaultEmbeddings';
import { allVectorDbClients, useDefaultVectorDbStore } from '~/store/defaultVectorDb';
import { errToString } from '~/utils/strings';

const errorMessage = ref('');
const defaultClientOptions = allCompleteClients.map((client) => {
  return { label: client, value: client };
});
const defaultModelOptions = {
  openai: allOpenAIModels.map((model) => {
    return { label: model, value: model };
  }),
};
const defaultVectorDbClientOptions = allVectorDbClients.map((client) => {
  return { label: client, value: client };
});

const defaultCompleteStore = useDefaultCompleteStore();
const defaultVectorDbStore = useDefaultVectorDbStore();
const defaultEmbeddingsStore = useDefaultEmbeddingsStore();
const { defaultCompleteConfig } = storeToRefs(defaultCompleteStore);
const { defaultVectorDbConfig } = storeToRefs(defaultVectorDbStore);
const { defaultEmbeddingsConfig, defaultEmbeddingsClient } = storeToRefs(defaultEmbeddingsStore);

await defaultCompleteStore.loadFromLocalStore();
await defaultVectorDbStore.loadFromLocalStore();
await defaultEmbeddingsStore.loadFromLocalStore();

watch(
  defaultCompleteConfig,
  () => {
    /* update the embeddings according to the complete config as they are the same one normally */
    defaultEmbeddingsClient.value.type = defaultCompleteConfig.value.client;
    defaultEmbeddingsClient.value.info.apiKey = defaultCompleteConfig.value.meta.apiKey;
    defaultEmbeddingsConfig.value.client_type = defaultCompleteConfig.value.client;
  },
  { immediate: true },
);

const isFormValid = computed(() => {
  errorMessage.value = '';
  try {
    defaultEmbeddingsStore.validateStore();
    defaultVectorDbStore.validateStore();
    defaultCompleteStore.validateStore();
    return true;
  } catch (e: any) {
    errorMessage.value = e.toString();
    return false;
  }
});

async function go() {
  await (async () => {})()
    .then(() => defaultCompleteStore.storeToLocalStore())
    .then(() => defaultVectorDbStore.storeToLocalStore())
    .then(() => defaultEmbeddingsStore.storeToLocalStore())
    .then(
      () => {
        navigateTo(`/main`);
      },
      (reason) => {
        message.error(`Failed to persist the presets: ${errToString(reason)}`);
      },
    );
}
</script>
