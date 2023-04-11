<template>
  <SelectOrCreate
    :loading="isLoading"
    :options="availableClientsUiData || []"
    v-model:value="selectedId"
    v-model:creating="isCreating"
    @ok="onCreate"
    title="New Embeddings Client"
  >
    <template #createForm>
      <a-form :model="formState" :label-col="{ span: 4 }">
        <!-- Name -->
        <a-form-item
          label="Name"
          name="name"
          :rules="[{ required: true, message: 'Please choose an unique name for this config!' }]"
        >
          <a-input v-model:value="formState.name" />
        </a-form-item>
        <!-- Embedding Client -->
        <a-form-item label="Client" name="type" :rules="[{ required: true }]">
          <a-select v-model:value="formState.type" :options="allClientTypes"></a-select>
        </a-form-item>
      </a-form>
      <a-form v-if="formState.type == 'openai'" :model="formState.info" :label-col="{ span: 4 }">
        <a-form-item label="Api Key" name="apiKey" :rules="[{ required: true }]">
          <a-input v-model:value="formState.info.apiKey" />
        </a-form-item>
      </a-form>
    </template>
  </SelectOrCreate>
</template>

<script setup lang="ts">
import { message } from 'ant-design-vue';
import { ref } from 'vue';
import { GetEmbeddingsClientData } from '~/utils/bindings';

const { id = null, value } = defineProps<{ id?: number; value: GetEmbeddingsClientData | undefined }>();
const emits = defineEmits(['update:id', 'update:value']);

const selectedId = ref<number | null>(id);
watch(selectedId, async (newId) => {
  emits('update:id', newId);
  const value = availableClients.value?.find((client) => client.id == newId);
  emits('update:value', value);
});

const isLoading = ref<boolean>(false);
const isCreating = ref<boolean>(false);

const allClientTypes = ref([
  {
    value: 'openai',
    label: 'openai',
  },
]);

function dbDataToUi(config: GetEmbeddingsClientData) {
  return {
    value: config.id,
    label: config.name,
  };
}

const formState = ref<CreateEmbeddingsClientFormState>({
  type: 'openai',
  name: '',
  info: {},
});

const { data: availableClients } = useAsyncData('availableEmbeddingsClients', async () => {
  isLoading.value = true;
  let clients: GetEmbeddingsClientData[] = [];
  try {
    clients = await getEmbeddingsClients();
    selectedId.value = selectedId.value || clients[0]?.id;
  } catch (e) {
    message.error('Failed to load Embeddings configs');
  }
  isLoading.value = false;
  return clients;
});
const availableClientsUiData = computed(() => availableClients.value?.map(dbDataToUi));

async function onCreate() {
  await nextTick(async () => {
    if (formState.value) {
      // todo: validate

      // update db
      const newDbConf = await createEmbeddingsClient({
        type: formState.value.type,
        name: formState.value.name,
        info: formState.value.info,
      });

      // update ui
      availableClients.value = [newDbConf, ...(availableClients.value || [])];
      selectedId.value = newDbConf.id;

      // notify
      message.info(`New ${formState.value.name} Embeddings Client added!`);
    }

    isCreating.value = false;
  });
}
</script>
