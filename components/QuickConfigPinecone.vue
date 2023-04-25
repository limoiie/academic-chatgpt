<template>
  <a-input-group compact>
    <!--<a-select v-model:value="defaultVectorDbClient.type" class="w-26" :options="defaultVectorDbClientOptions" />-->
    <a-tooltip :visible="!isApiKeyPristine && apiKeyError != ''" :title="apiKeyError" placement="bottom" color="red">
      <a-input-password
        v-model:value="clientConfig.info.apiKey"
        class="w-64!"
        placeholder="Api Key"
        :on-blur="markApiKeyAsDirty"
      />
    </a-tooltip>
    <a-tooltip
      :visible="!isEnvironmentPristine && environmentError != ''"
      :title="environmentError"
      placement="bottom"
      color="red"
    >
      <a-input
        v-model:value="clientConfig.info.environment"
        class="w-32!"
        placeholder="Environment"
        :on-blur="markEnvironmentAsDirty"
      />
    </a-tooltip>
    <!--<a-input v-model:value="clientConfig.info.indexName" class="w-32!" placeholder="Index Name" />-->
    <a-auto-complete
      v-model:value="clientConfig.info.indexName"
      class="w-32!"
      :options="pineconeIndexOptions"
      placeholder="Index Name"
    />
  </a-input-group>
</template>

<script setup lang="ts">
import { PineconeClient } from '@pinecone-database/pinecone';
import { VectorDbClientExData } from '~/plugins/tauri/bindings';

const apiKeyError = ref('');
const environmentError = ref('');
const emits = defineEmits(['update:valid', 'update:error', 'update:validating']);
const props = defineProps<{ client: VectorDbClientExData }>();
const { client: clientConfig } = toRefs(props);
watch(
  clientConfig,
  async () => {
    emits('update:valid', false);
    emits('update:validating', true);
    emits('update:error', '');
    apiKeyError.value = '';
    environmentError.value = '';

    await Promise.resolve()
      .then(() => validate())
      .catch((e) => {
        emits('update:error', errToString(e));
      })
      .finally(() => {
        emits('update:validating', false);
      });
  },
  {
    deep: true,
    immediate: true,
  },
);

const isApiKeyPristine = ref(clientConfig.value.info.apiKey === '');
const isEnvironmentPristine = ref(clientConfig.value.info.environment === '');

const pineconeIndexes = ref<string[]>([]);
const pineconeIndexOptions = computed(() => {
  return pineconeIndexes.value.map((index) => {
    return { label: index, value: index };
  });
});

async function validate() {
  emits('update:valid', false);
  if (
    !validateApiKeyForm(clientConfig.value.info.apiKey || '') ||
    !validateEnvironmentForm(clientConfig.value.info.environment || '')
  ) {
    return;
  }

  const client = new PineconeClient();
  await client.init({
    apiKey: clientConfig.value.info.apiKey,
    environment: clientConfig.value.info.environment,
  });
  pineconeIndexes.value = await client.listIndexes();
  if (!clientConfig.value.info.indexName) {
    return;
  }

  emits('update:valid', true);
}

function validateApiKeyForm(apiKey: string) {
  if (apiKey.length != 36) {
    apiKeyError.value = 'Api key must be 36 characters long';
    return false;
  }
  const res = apiKey.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
  if (res?.length == 1) {
    return true;
  }
  apiKeyError.value = 'Api key must be in the format xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
  return false;
}

function validateEnvironmentForm(environment: string) {
  if (environment.length == 0) {
    environmentError.value = 'Environment must not be empty';
    return false;
  }
  const res = environment.match(/^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/i);
  if (res?.length == 1) {
    return true;
  }
  environmentError.value = 'Environment must be in the format xxx-xxx-xxx';
  return false;
}

function markApiKeyAsDirty() {
  isApiKeyPristine.value = false;
}

function markEnvironmentAsDirty() {
  isEnvironmentPristine.value = false;
}
</script>
