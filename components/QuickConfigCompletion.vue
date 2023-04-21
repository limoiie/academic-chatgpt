<template>
  <a-input-group compact>
    <a-tooltip :visible="!isApiKeyPristine && apiKeyError != ''" :title="apiKeyError" color="red">
      <a-input-password
        v-model:value="config.meta.apiKey"
        class="w-64!"
        placeholder="Api Key"
        :on-blur="markApiKeyAsDirty"
      />
    </a-tooltip>
    <a-select v-model:value="config.meta.model" :options="modelOptions[config.client]" />
  </a-input-group>
</template>

<script setup lang="ts">
import { Configuration, OpenAIApi } from 'openai';
import { allCompletionOpenAIModels } from '~/types';

const apiKeyError = ref('');
const emits = defineEmits(['update:valid', 'update:validating', 'update:error']);
const props = defineProps<{ config: CompletionConfig }>();
const { config } = toRefs(props);
watch(
  config,
  async () => {
    emits('update:valid', false);
    emits('update:validating', true);
    emits('update:error', '');
    apiKeyError.value = '';

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

const isApiKeyPristine = ref(config.value.meta.apiKey === '');

const modelOptions = {
  openai: allCompletionOpenAIModels.map((model) => {
    return { label: model, value: model };
  }),
};

async function validate() {
  emits('update:valid', false);
  if (!validateApiKeyForm(config.value.meta.apiKey) || !validateModelForm(config.value.meta.model)) {
    return;
  }

  const api = new OpenAIApi(
    new Configuration({
      apiKey: config.value.meta.apiKey,
    }),
  );
  await api
    .retrieveModel(config.value.meta.model)
    .catch((e) => {
      throw Error(`Failed to request openai: ${e}`);
    })
    .then((response) => {
      if (response.status !== 200) {
        throw Error(`Failed to request openai: code ${response.status} - ${response.statusText}`);
      }
      return response;
    });

  emits('update:valid', true);
}

function validateApiKeyForm(apiKey: string) {
  const res = apiKey.match(/^sk-[a-z0-9]{48}$/i);
  const valid = res?.length == 1;
  if (!valid) {
    apiKeyError.value = 'Invalid API key';
  }
  return valid;
}

function validateModelForm(model: string) {
  return model !== '';
}

function markApiKeyAsDirty() {
  isApiKeyPristine.value = false;
}
</script>
