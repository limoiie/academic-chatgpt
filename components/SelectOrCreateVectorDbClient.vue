<template>
  <SelectOrCreate
    :loading="isLoading"
    :options="availableUiDataClients || []"
    v-model:value="selectedId"
    v-model:creating="isCreating"
    v-model:previewing="isPreviewing"
    @ok="onCreate"
    title="New Vector Db Client"
  >
    <template #createForm>
      <a-form :model="formState" :label-col="{ span: 6 }">
        <!-- Client name -->
        <a-form-item label="Name" name="name" :rules="[{ required: true, message: 'Already exists' }]">
          <a-input v-model:value="formState.name" />
        </a-form-item>

        <!-- Client type -->
        <a-form-item label="Client" name="type" :rules="[{ required: true }]">
          <a-select v-model:value="formState.type" :options="[{ label: 'Pinecone', value: 'pinecone' }]" />
        </a-form-item>
      </a-form>

      <!-- Client info settings -->
      <!--  - pinecone -->
      <a-form v-if="formState.type == 'pinecone'" :model="formState.info" :label-col="{ span: 6 }">
        <a-form-item label="Api Key" name="apiKey" :rules="[{ required: true }]">
          <a-input-password v-model:value="formState.info.apiKey" />
        </a-form-item>
        <a-form-item label="Environment" name="environment" :rules="[{ required: true }]">
          <a-input v-model:value="formState.info.environment" />
        </a-form-item>
        <a-form-item label="Index Name" name="indexName" :rules="[{ required: true }]">
          <a-input v-model:value="formState.info.indexName" />
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
import { CreateVectorDbClientData, VectorDbClientExData } from '~/plugins/tauri/bindings';

const { id = null, value } = defineProps<{
  /**
   * The id of the selected vectorstore client.
   */
  id?: number;
  /**
   * The selected vectorstore client.
   */
  value: VectorDbClientExData | undefined;
}>();
const emits = defineEmits(['update:id', 'update:value']);

const { $tauriCommands } = useNuxtApp();

const selectedId = ref<number | null>(id);
const isLoading = ref(false);
const isCreating = ref(false);
const isPreviewing = ref(false);

/**
 * The form state for creating a new vector db client.
 */
const formState = reactive<CreateVectorDbClientData>({
  name: '',
  type: 'pinecone',
  info: {
    apiKey: '',
    environment: '',
    indexName: '',
  },
});

/**
 * Load available vectorstore clients from the database.
 */
const { data: availableClients } = useAsyncData('availableVectorDbClients', () => {
  return Promise.resolve((isLoading.value = true))
    .then(async () => {
      const data: VectorDbClientExData[] = await $tauriCommands.getVectorDbClients();
      selectedId.value = selectedId.value || data[0]?.id;
      return data;
    })
    .catch((e) => {
      message.error(`Failed to load index clients: ${errToString(e)}`);
    })
    .finally(() => {
      isLoading.value = false;
    });
});
const availableUiDataClients = computed(() => availableClients.value?.map(dbDataToUi));

/**
 * Notify the selected config has changed if id or the available configs change.
 */
watch([selectedId, availableClients], ([newConfigId, configs]) => {
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
      const newDbClient = await $tauriCommands.createVectorDbClient({
        type: formState.type,
        name: formState.name,
        info: formState.info,
      });

      // update ui
      selectedId.value = newDbClient.id;
      availableClients.value = [newDbClient, ...(availableClients.value || [])];
    })
    .then(() => {
      message.info(`New ${formState.name} Vector Db Config Created!`);
    })
    .catch((e) => {
      message.error(`Failed to create new vector db config: ${errToString(e)}`);
    })
    .finally(() => (isCreating.value = false));
}

function dbDataToUi(client: VectorDbClientExData) {
  return {
    value: client.id,
    label: client.name,
  };
}
</script>
