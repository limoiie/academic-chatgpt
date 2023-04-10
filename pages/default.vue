<template>
  <a-card class="w-fit m-auto! mt-20!" hoverable title="Presets">
    <a-space direction="vertical" size="middle" class="w-full h-full">
      <div class="flex flex-col">
        <!--<a-divider orientation="left" orientation-margin="0">AI</a-divider>-->
        <a-input-group compact>
          <a-select v-model:value="defaultAIClient" class="w-24 flex" :options="defaultClientOptions" />
          <a-select v-model:value="defaultAIModel" class="w-45 flex" :options="defaultModelOptions[defaultAIClient]" />
          <a-input v-model:value="defaultAIApiKey" class="w-64!" placeholder="Api Key" />
        </a-input-group>
      </div>
      <div class="flex flex-col">
        <!--<a-divider orientation="left" orientation-margin="0">Vector Database</a-divider>-->
        <a-input-group compact>
          <a-select v-model:value="defaultVectorDbClient" class="w-26" :options="defaultVectorDbClientOptions" />
          <a-input v-model:value="defaultVectorDbApiKey" class="w-64!" placeholder="Api Key" />
          <a-input v-model:value="defaultVectorDbMeta.indexName" class="w-32!" placeholder="Index Name" />
          <a-input v-model:value="defaultVectorDbMeta.environment" class="w-32!" placeholder="Environment" />
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
import { allAIClients, allOpenAIModels, useDefaultAIStore } from '~/store/defaultAI';
import { allVectorDbClients, useDefaultVectorDbStore } from '~/store/defaultVectorDb';

const defaultClientOptions = allAIClients.map((client) => {
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

const defaultAIStore = useDefaultAIStore();
const defaultVectorDbStore = useDefaultVectorDbStore();
const { defaultAIApiKey, defaultAIClient, defaultAIModel } = storeToRefs(defaultAIStore);
const { defaultVectorDbApiKey, defaultVectorDbClient, defaultVectorDbMeta } = storeToRefs(defaultVectorDbStore);

const isFormValid = computed(() => {
  return (
    defaultAIApiKey.value &&
    defaultAIClient.value &&
    defaultAIModel.value &&
    defaultVectorDbApiKey.value &&
    defaultVectorDbClient.value &&
    defaultVectorDbMeta.value
  );
});

async function go() {
  const aiReady = await defaultAIStore.storeToLocalStore();
  const dbReady = await defaultVectorDbStore.storeToLocalStore();
  if (aiReady && dbReady) {
    navigateTo('/main');
    message.info('Succeed to store the presets!');
  } else {
    message.error(`Failed to store the presets: ${aiReady} ${dbReady}`);
  }
}
</script>
