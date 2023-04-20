<template>
  <a-card class="w-fit max-w-2xl m-auto! mt-20!" hoverable title="Presets">
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
          <a-select v-model:value="defaultVectorDbClient.type" class="w-26" :options="defaultVectorDbClientOptions" />
          <a-input v-model:value="defaultVectorDbClient.info.apiKey" class="w-64!" placeholder="Api Key" />
          <a-input v-model:value="defaultVectorDbClient.info.environment" class="w-32!" placeholder="Environment" />
          <a-input v-model:value="defaultVectorDbClient.info.indexName" class="w-32!" placeholder="Index Name" />
        </a-input-group>
      </div>
      <a-alert v-if="errorMessage" type="error" show-icon title="Invalid presets" :message="errorMessage" />
      <div class="flex flex-row">
        <div class="flex flex-grow" />
        <a-button type="primary" @click="go">Go</a-button>
      </div>
    </a-space>
  </a-card>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { useDefaultCompleteStore } from '~/store/defaultComplete';
import { useDefaultEmbeddingsStore } from '~/store/defaultEmbeddings';
import { allVectorDbClients, useDefaultVectorDbStore } from '~/store/defaultVectorDb';
import { useIndexProfilesStore } from '~/store/indexProfiles';
import { allCompletionClients, allCompletionOpenAIModels } from '~/types';
import { errToString } from '~/utils/strings';

const errorMessage = ref('');
const defaultClientOptions = allCompletionClients.map((client) => {
  return { label: client, value: client };
});
const defaultModelOptions = {
  openai: allCompletionOpenAIModels.map((model) => {
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
const { defaultVectorDbClient, defaultVectorDbConfig } = storeToRefs(defaultVectorDbStore);
const { defaultEmbeddingsClient, defaultEmbeddingsConfig } = storeToRefs(defaultEmbeddingsStore);

const indexProfilesStore = useIndexProfilesStore();

await Promise.resolve()
  .then(async () => {
    await defaultVectorDbStore.load();
    await defaultEmbeddingsStore.load();
    await defaultCompleteStore.load();

    await indexProfilesStore.load();
  })
  .catch(() => {});

// Propagate the change of default complete client to the default embeddings
// client and config, so that the user can provide only a few necessary
// information
watch(
  defaultCompleteConfig,
  () => {
    // by default, we use the same client for embeddings as for the complete client
    defaultEmbeddingsClient.value.type = defaultCompleteConfig.value.client;
    defaultEmbeddingsClient.value.info.apiKey = defaultCompleteConfig.value.meta.apiKey;

    // by default, we use the same name as the type
    defaultEmbeddingsClient.value.name = defaultCompleteConfig.value.client;
    defaultEmbeddingsConfig.value.name = defaultCompleteConfig.value.client;
    // sync the client type of default config with the default client
    defaultEmbeddingsConfig.value.clientType = defaultCompleteConfig.value.client;
  },
  { immediate: true },
);
// Propagate the change of default vector database client so that the user can
// provide only a few necessary information
watch(defaultVectorDbClient, () => {
  // by default, we use the same name as the type
  defaultVectorDbClient.value.name = defaultVectorDbClient.value.type;
  defaultVectorDbConfig.value.name = defaultVectorDbClient.value.type;
  // sync the client type of default config with the default client
  defaultVectorDbConfig.value.clientType = defaultVectorDbClient.value.type;
});

function validateForm() {
  errorMessage.value = '';
  try {
    defaultEmbeddingsStore.validateStore();
    defaultVectorDbStore.validateStore();
    defaultCompleteStore.validateStore();
  } catch (e: any) {
    errorMessage.value = e.toString();
    return false;
  }
  return true;
}

/**
 * Go to the main page.
 *
 * Before that, we need to persist the presets to the local store so that
 * future logins can access them.
 */
async function go() {
  await Promise.resolve()
    .then(() => {
      if (!validateForm()) {
        throw new Error('Invalid form');
      }
    })
    .then(async () => {
      await defaultCompleteStore.store();
      await defaultVectorDbStore.store();
      await defaultEmbeddingsStore.store();

      await indexProfilesStore.upsertDefaultIndexProfile(
        defaultEmbeddingsClient.value,
        defaultEmbeddingsConfig.value,
        defaultVectorDbClient.value,
        defaultVectorDbConfig.value,
      );
      await indexProfilesStore.storeCacheToTauriStore();
    })
    .then(() => {
      navigateTo(`/main`);
    })
    .catch((reason) => {
      message.error(`Failed to persist the presets: ${errToString(reason)}`);
    });
}
</script>
