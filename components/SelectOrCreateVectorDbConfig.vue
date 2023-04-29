<template>
  <SelectOrCreate
    :loading="isLoading"
    :options="availableUiDataConfigs || []"
    v-model:value="selectedId"
    v-model:creating="isCreating"
    v-model:previewing="isPreviewing"
    @ok="onCreate"
    title="New Vector Db Config"
  >
    <template #createForm>
      <a-form :model="formState" :label-col="{ span: 8 }">
        <!-- Config name -->
        <a-form-item label="Name" name="name" :rules="[{ required: true, message: 'Already exists' }]">
          <a-input v-model:value="formState.name" />
        </a-form-item>

        <!-- Client type -->
        <a-form-item label="Client Type">
          <span class="ant-form-text">{{ clientType }}</span>
        </a-form-item>
      </a-form>

      <!-- Config details -->
      <!--  - pinecone -->
      <a-form v-if="clientType == 'pinecone'" :model="formState.meta" :label-col="{ span: 8 }">
        <a-tooltip>
          <template #title>OpenAI only supports 1536 so far</template>
          <a-form-item label="Embedding Dim" name="dimension" :rules="[{ required: true }]">
            <a-input-number v-model:value="formState.meta.dimension" :default-value="1536" />
          </a-form-item>
        </a-tooltip>
        <a-form-item label="Similarity Metric" name="metric" :rules="[{ required: true }]">
          <a-select v-model:value="formState.meta.metric" :options="pineconeMetrics" />
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
import { VectorDbConfigExData } from '~/plugins/tauri/bindings';

const {
  id = null,
  clientType = null,
  value,
} = defineProps<{
  /**
   * The id of the selected config.
   */
  id?: number;
  /**
   * The client type.
   */
  clientType?: string;
  /**
   * The selected config.
   */
  value: VectorDbConfigExData | undefined;
}>();
const emits = defineEmits(['update:id', 'update:value']);

const { $tauriCommands } = useNuxtApp();

const pineconeMetrics = [
  {
    label: 'Cosine',
    value: 'cosine',
  },
];

const selectedId = ref<number | null>(id);
const isLoading = ref(false);
const isCreating = ref(false);
const isPreviewing = ref(false);

/**
 * The form state for creating a new vector db config.
 */
const formState = reactive<CreateVectorDbConfigFormState>({
  clientType: clientType || 'pinecone',
  name: '',
  meta: {
    metric: 'cosine',
    dimension: 1536,
  },
});

/**
 * Load available vectorstore configs from the database.
 */
const { data: availableConfigs } = useAsyncData('availableVectorDbConfigs', () => {
  return Promise.resolve((isLoading.value = true))
    .then(async () => {
      const data: VectorDbConfigExData[] = await $tauriCommands.getVectorDbConfigs();
      selectedId.value = selectedId.value || data[0]?.id;
      return data;
    })
    .catch((e) => {
      message.error(`Failed to load index configs: ${errToString(e)}`);
    })
    .finally(() => {
      isLoading.value = false;
    });
});
const availableUiDataConfigs = computed(() => availableConfigs.value?.map(dbDataToUi));

/**
 * Notify the selected config has changed if id or the available configs change.
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
      const newDbConf = await $tauriCommands.createVectorDbConfig({
        clientType: formState.clientType,
        name: formState.name,
        meta: formState.meta,
      });

      // update ui
      selectedId.value = newDbConf.id;
      availableConfigs.value = [newDbConf, ...(availableConfigs.value || [])];
    })
    .then(() => {
      message.info(`New ${formState.name} Vector Db Config Created!`);
    })
    .catch((e) => {
      message.error(`Failed to create new vector db config: ${errToString(e)}`);
    })
    .finally(() => (isCreating.value = false));
}

function dbDataToUi(config: VectorDbConfigExData) {
  return {
    value: config.id,
    label: config.name,
  };
}
</script>
