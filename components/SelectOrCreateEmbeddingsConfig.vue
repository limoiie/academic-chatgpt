<template>
  <SelectOrCreate
    :loading="isLoadingConfigs"
    :options="availableConfigsUiData || []"
    v-model:value="selectedConfigId"
    v-model:creating="isCreatingConfig"
    @ok="onCreate"
    title="New Embeddings Config"
  >
    <template #createForm>
      <a-form :model="formState">
        <!-- Name -->
        <a-form-item
          label="Name"
          name="name"
          :rules="[{ required: true, message: 'Please choose an unique name for this config!' }]"
        >
          <a-input v-model:value="formState.name" />
        </a-form-item>
      </a-form>
      <!-- Config -->
      <a-form :model="formState.meta">
        <a-form-item label="Embedding Dim" name="dimension" :rules="[{ required: true }]">
          <a-input-number
            v-model:value="formState.meta.dimension"
            :default-value="1536"
            :disabled="clientType == 'openai'"
          />
        </a-form-item>
      </a-form>
    </template>
  </SelectOrCreate>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue';
import { ref } from 'vue';
import { GetEmbeddingsConfigData } from '~/utils/bindings';

const isLoadingConfigs = ref<boolean>(false);
const isCreatingConfig = ref<boolean>(false);

const {
  id = undefined,
  clientType,
  value,
} = defineProps<{
  id: number | undefined;
  value: GetEmbeddingsConfigData | undefined;
  clientType: string | undefined;
}>();
const emits = defineEmits(['update:id', 'update:value']);

const selectedConfigId = ref<number | undefined>(id);
watch(selectedConfigId, (newConfigId) => {
  emits('update:id', newConfigId);
  const value = availableConfigs.value?.find((config) => config.id == newConfigId);
  emits('update:value', value);
});

function dbDataToUi(config: GetEmbeddingsConfigData) {
  return {
    value: config.id,
    label: config.name,
  };
}

const formState = ref<CreateEmbeddingsConfigFormState>({
  clientType: 'openai',
  name: '',
  meta: {},
});

const { data: availableConfigs } = useAsyncData('availableEmbeddingsConfigs', async () => {
  isLoadingConfigs.value = true;
  let data: GetEmbeddingsConfigData[] = [];
  try {
    data = await getEmbeddingsConfigs();
    selectedConfigId.value = selectedConfigId.value || data[0]?.id;
  } catch (e) {
    message.error('Failed to load Embeddings configs');
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
      const newDbConf = await createEmbeddingsConfig({
        client_type: formState.value.clientType,
        name: formState.value.name,
        meta: formState.value.meta,
      });

      // update ui
      availableConfigs.value = [newDbConf, ...(availableConfigs.value || [])];
      selectedConfigId.value = newDbConf.id;

      // notify
      message.info(`New ${formState.value.name} Embeddings Config Created!`);
    }

    isCreatingConfig.value = false;
  });
}
</script>
