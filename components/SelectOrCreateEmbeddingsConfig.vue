<template>
  <SelectOrCreate
    :loading="isLoading"
    :options="availableUiDataConfigs || []"
    v-model:value="selectedId"
    v-model:creating="isCreating"
    v-model:previewing="isPreviewing"
    @ok="onCreate"
    title="New Embeddings Config"
  >
    <template #createForm>
      <a-form :model="formState" :label-col="{ span: 8 }">
        <!-- Config name -->
        <a-form-item
          label="Name"
          name="name"
          :rules="[{ required: true, message: 'Please choose an unique name for this config!' }]"
        >
          <a-input v-model:value="formState.name" />
        </a-form-item>

        <!-- Client type -->
        <a-form-item label="Client Type">
          <span class="ant-form-text">{{ clientType }}</span>
        </a-form-item>
      </a-form>

      <!-- Embeddings config -->
      <!--  - openai -->
      <a-form v-if="clientType == 'openai'" :model="formState.meta" :label-col="{ span: 8 }">
        <a-form-item label="Embedding Dim" name="dimension" :rules="[{ required: true }]">
          <a-input-number v-model:value="formState.meta.dimension" :default-value="1536" :disabled="true" />
        </a-form-item>
      </a-form>
      <!--  - otherwise, alert -->
      <a-alert v-else message="Not supported yet" type="warning" show-icon style="margin-bottom: 1rem" />
    </template>

    <template #preview>
      <p class="whitespace-pre-wrap">
        {{ stringify(value) }}
      </p>
    </template>
  </SelectOrCreate>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue';
import { reactive, ref } from 'vue';
import { stringify } from 'yaml';
import { EmbeddingsConfigExData } from '~/plugins/tauri/bindings';

/**
 * The props provide initial values for the target embeddings config.
 */
const {
  id = null,
  clientType = null,
  value,
} = defineProps<{
  /**
   * The id of the selected config. If not set, the first config will be selected by default
   */
  id?: number;
  /**
   * The value of the selected embeddings config
   */
  value: EmbeddingsConfigExData | undefined;
  /**
   * The type of the embedding client
   */
  clientType?: string;
}>();
const emits = defineEmits(['update:id', 'update:value']);

const { $tauriCommands } = useNuxtApp();

const selectedId = ref<number | null>(id);
const isLoading = ref<boolean>(false);
const isCreating = ref<boolean>(false);
const isPreviewing = ref<boolean>(false);

/**
 * The form state for creating a new embeddings config
 */
const formState = reactive<CreateEmbeddingsConfigFormState>({
  clientType: clientType || 'openai',
  name: '',
  meta: {},
});

/**
 * Load the available embeddings configs from the database.
 *
 * If the selected id is not set, the first config will be selected by default.
 */
const { data: availableConfigs } = useAsyncData('availableEmbeddingsConfigs', () => {
  return Promise.resolve((isLoading.value = true))
    .then(async () => {
      const data: EmbeddingsConfigExData[] = await $tauriCommands.getEmbeddingsConfigs();
      selectedId.value = selectedId.value || data[0]?.id;
      return data;
    })
    .catch((e) => {
      message.error(`Failed to load Embeddings configs: ${errToString(e)}`);
    })
    .finally(() => (isLoading.value = false));
});
const availableUiDataConfigs = computed(() => availableConfigs.value?.map(dbDataToUi));

/**
 * Notify the selected config has changed if the id or available configs changed.
 */
watch([selectedId, availableConfigs], ([newConfigId, configs]) => {
  emits('update:id', newConfigId);
  emits(
    'update:value',
    configs?.find((config) => config.id == newConfigId),
  );
});

function onCreate() {
  return Promise.resolve()
    .then(async () => {
      // todo: validate

      // update db
      const newDbConf = await $tauriCommands.createEmbeddingsConfig({
        clientType: formState.clientType,
        name: formState.name,
        meta: formState.meta,
      });

      // update ui
      availableConfigs.value = [newDbConf, ...(availableConfigs.value || [])];
      selectedId.value = newDbConf.id;
    })
    .then(() => {
      message.info(`New ${formState.name} Embeddings Config Created!`);
    })
    .catch((e) => {
      message.error(`Failed to create Embeddings Config: ${errToString(e)}`);
    })
    .finally(() => (isCreating.value = false));
}

function dbDataToUi(config: EmbeddingsConfigExData) {
  return {
    value: config.id,
    label: config.name,
  };
}
</script>
