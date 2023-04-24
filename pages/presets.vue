<template>
  <div class="w-full h-full flex flex-col items-center">
    <a-card class="w-fit max-w-2xl mx-4! mt-24!" title="Presets">
      <a-space direction="vertical" size="middle" class="w-full h-full">
        <div class="flex flex-col">
          <!--<a-divider orientation="left" orientation-margin="0">AI</a-divider>-->
          <a-space>
            <!--suppress TypeScriptUnresolvedReference -->
            <div class="flex flex-row items-baseline">
              {{ defaultCompleteConfig.client }}&nbsp;
              <a-popover>
                <template #content>
                  <p class="w-48">
                    We use <a href="https://platform.openai.com/docs/api-reference">openai api</a> for chat completion
                    and embedding. You may find and create your own api key in your
                    <a href="https://platform.openai.com/account/api-keys">User settings</a>.
                  </p>
                </template>
                <InfoCircleTwoTone />
              </a-popover>
            </div>
            <QuickConfigCompletion
              :config="defaultCompleteConfig"
              @update:validating="updateValidating"
              @update:valid="updateCompletionValid"
              @update:error="updateValidationError"
            />
          </a-space>
        </div>
        <div class="flex flex-col">
          <!--<a-divider orientation="left" orientation-margin="0">Vector Database</a-divider>-->
          <a-space>
            <div class="flex flex-row items-baseline">
              {{ defaultVectorDbClient.type }}&nbsp;
              <a-popover>
                <template #content>
                  <p class="w-64">
                    We use <a href="https://www.pinecone.io/">pinecone</a> as vector DB to store embeddings of
                    paragraphs. During chatting, the question will be embedded and searched in the DB to find the most
                    similar paragraphs as the chat context. You may create and find your own api key with environment in
                    your <a href="https://app.pinecone.io/">Pinecone console</a>. You also <b>NEED</b> to create an
                    index.
                  </p>
                </template>
                <InfoCircleTwoTone />
              </a-popover>
            </div>
            <QuickConfigPinecone
              :client="defaultVectorDbClient"
              @update:validating="updateValidating"
              @update:valid="updateVectorstoreValid"
              @update:error="updateValidationError"
            />
          </a-space>
        </div>
        <a-alert v-if="errorMessage" type="error" show-icon title="Invalid presets" :message="errorMessage" />
        <div class="flex flex-row">
          <div class="flex flex-grow" />
          <a-button
            type="primary"
            :disabled="!isValidating && !isPersisting && !isValid"
            :loading="isValidating != 0 || isPersisting"
            @click="go"
          >
            Go
          </a-button>
        </div>
      </a-space>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { InfoCircleTwoTone } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { useDefaultCompleteStore } from '~/store/defaultComplete';
import { useDefaultEmbeddingsStore } from '~/store/defaultEmbeddings';
import { useDefaultVectorDbStore } from '~/store/defaultVectorDb';
import { useIndexProfileStore } from '~/store/indexProfiles';
import { errToString } from '~/utils/strings';

const isPersisting = ref<boolean>(false);
const isValidating = ref<number>(0);
const isVectorstoreValid = ref<boolean>(false);
const isCompleteValid = ref<boolean>(false);
const isValid = computed(() => isVectorstoreValid.value && isCompleteValid.value);
const errorMessage = ref<string>('');

const defaultCompletionStore = useDefaultCompleteStore();
const defaultVectorDbStore = useDefaultVectorDbStore();
const defaultEmbeddingsStore = useDefaultEmbeddingsStore();
const indexProfilesStore = useIndexProfileStore();
const { defaultCompleteConfig } = storeToRefs(defaultCompletionStore);
const { defaultVectorDbClient, defaultVectorDbConfig } = storeToRefs(defaultVectorDbStore);
const { defaultEmbeddingsClient, defaultEmbeddingsConfig } = storeToRefs(defaultEmbeddingsStore);

await Promise.resolve()
  .then(async () => {
    await defaultVectorDbStore.load();
    await defaultEmbeddingsStore.load();
    await defaultCompletionStore.load();
    await indexProfilesStore.load();
  })
  .catch((e) => {
    message.error(`Failed to load preset: ${errToString(e)}`);
  });

// Propagate the change of default complete client to the default embeddings
// client and config, so that the user can provide only a few necessary
// information
watch(
  defaultCompleteConfig,
  async () => {
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
watch(
  defaultVectorDbClient,
  async () => {
    // by default, we use the same name as the type
    defaultVectorDbClient.value.name = defaultVectorDbClient.value.type;
    defaultVectorDbConfig.value.name = defaultVectorDbClient.value.type;
    // sync the client type of default config with the default client
    defaultVectorDbConfig.value.clientType = defaultVectorDbClient.value.type;
  },
  {
    immediate: true,
  },
);

function updateCompletionValid(valid: boolean) {
  isCompleteValid.value = valid;
}

function updateVectorstoreValid(valid: boolean) {
  isVectorstoreValid.value = valid;
}

function updateValidating(validating: boolean) {
  validating ? ++isValidating.value : --isValidating.value;
}

function updateValidationError(error: string) {
  errorMessage.value = error;
}

/**
 * Go to the main page.
 *
 * Before that, we need to persist the presets to the local store so that
 * future logins can access them.
 */
async function go() {
  await Promise.resolve((isPersisting.value = true))
    .then(() => {
      defaultEmbeddingsStore.validateStore();
      defaultVectorDbStore.validateStore();
      defaultCompletionStore.validateStore();
    })
    .then(async () => {
      await defaultCompletionStore.store();
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
      message.info('Successfully persisted the presets');
    })
    .catch((e) => {
      message.error(`Failed to persist the presets: ${errToString(e)}`);
    })
    .finally(() => {
      isPersisting.value = false;
    });
}
</script>
