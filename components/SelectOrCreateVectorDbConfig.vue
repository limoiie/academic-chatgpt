<template>
  <SelectOrCreate
    :loading="isLoadingConfigs"
    :options="availableConfigsUiData || []"
    v-model:value="selectedConfigId"
    v-model:creating="isCreatingConfig"
    @ok="onCreate"
    title="New Vector Db Config"
  >
    <template #createForm>
      <a-form :model="formState">
        <!-- Config Name -->
        <a-form-item
          label="Name"
          name="name"
          :rules="[{ required: true, message: 'Please choose an unique name for this config!' }]"
        >
          <a-input v-model:value="formState.name" />
        </a-form-item>
        <!-- Index Client -->
        <a-form-item label="Client" name="clientType" :rules="[{ required: true }]">
          <div class="border px-2 pb-2">
            <a-tabs v-model:activeKey="formState.clientType">
              <!-- Pinecone panel -->
              <a-tab-pane key="pinecone" tab="Pinecone">
                <a-form :model="formState.meta">
                  <a-form-item label="Api Key" name="apiKey" :rules="[{ required: true }]">
                    <a-input v-model:value="formState.meta.apiKey" />
                  </a-form-item>
                  <a-form-item label="Environment" name="environment" :rules="[{ required: true }]">
                    <a-input v-model:value="formState.meta.environment" />
                  </a-form-item>
                  <a-form-item label="Index Name" name="indexName" :rules="[{ required: true }]">
                    <a-input v-model:value="formState.meta.indexName" />
                  </a-form-item>
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
              </a-tab-pane>
            </a-tabs>
          </div>
        </a-form-item>
      </a-form>
    </template>
  </SelectOrCreate>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue';
import { ref } from 'vue';
import { VectorDbConfigExData, getVectorDbConfigs } from '~/utils/bindings';

const isLoadingConfigs = ref(false);
const isCreatingConfig = ref(false);

const { id = null, value } = defineProps<{ id?: number; value: VectorDbConfigExData | undefined }>();
const emits = defineEmits(['update:id', 'update:value']);

const pineconeMetrics = [
  {
    label: 'Cosine',
    value: 'cosine',
  },
];

const formState = ref<CreateVectorDbConfigFormState>({
  clientType: 'pinecone',
  name: '',
  meta: {
    metric: 'cosine',
    dimension: 1536,
  },
});

const selectedConfigId = ref<number | null>(id);
watch(selectedConfigId, (newConfigId) => {
  emits('update:id', newConfigId);
  const value = availableConfigs.value?.find((config) => config.id == newConfigId);
  emits('update:value', value);
});

function dbDataToUi(config: VectorDbConfigExData) {
  return {
    value: config.id,
    label: config.name,
  };
}

const { data: availableConfigs } = useAsyncData('availableVectorDbConfigs', async () => {
  isLoadingConfigs.value = true;
  let data: VectorDbConfigExData[] = [];
  try {
    data = await getVectorDbConfigs();
    selectedConfigId.value = selectedConfigId.value || data[0]?.id;
  } catch (e) {
    message.error('Failed to load index configs');
  }
  isLoadingConfigs.value = false;
  return data;
});
const availableConfigsUiData = computed(() => availableConfigs.value?.map(dbDataToUi));

async function onCreate() {
  await nextTick(async () => {
    if (formState.value) {
      // todo: validate

      // update db
      const newDbConf = await createVectorDbConfig({
        clientType: formState.value.clientType,
        name: formState.value.name,
        meta: formState.value.meta,
      });

      // update ui
      selectedConfigId.value = newDbConf.id;
      availableConfigs.value = [newDbConf, ...(availableConfigs.value || [])];

      // notify
      message.info(`New ${formState.value.name} Vector Db Config Created!`);
    }

    isCreatingConfig.value = false;
  });
}
</script>
