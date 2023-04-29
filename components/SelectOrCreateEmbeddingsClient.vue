<template>
  <SelectOrCreate
    :loading="isLoading"
    :options="availableClientsUiData || []"
    v-model:value="selectedId"
    v-model:creating="isCreating"
    v-model:previewing="isPreviewing"
    @create="onCreate"
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

      <!-- Embedding meta -->
      <!--  - openai -->
      <a-form v-if="formState.type == 'openai'" :model="formState.info" :label-col="{ span: 4 }">
        <a-form-item label="Api Key" name="apiKey" :rules="[{ required: true }]">
          <a-input v-model:value="formState.info.apiKey" />
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
import { EmbeddingsClientExData } from '~/plugins/tauri/bindings';

const { id = null, value } = defineProps<{
  /**
   * The id of the selected embedding client. If not set, the first client will be selected by default
   */
  id?: number;
  /**
   * The value of the selected embeddings client
   */
  value: EmbeddingsClientExData | undefined;
}>();
const emits = defineEmits(['update:id', 'update:value']);

const { $tauriCommands } = useNuxtApp();

const selectedId = ref<number | null>(id);
const isLoading = ref<boolean>(false);
const isCreating = ref<boolean>(false);
const isPreviewing = ref<boolean>(false);

const allClientTypes = ref([
  {
    value: 'openai',
    label: 'openai',
  },
]);

/**
 * Form data for creating a new embedding client.
 *
 * @typedef {Object} CreateEmbeddingsClientFormState
 */
const formState = reactive<CreateEmbeddingsClientFormState>({
  type: 'openai',
  name: '',
  info: {},
});

/**
 * Load available embeddings clients from the database.
 *
 * Also set the first client as the selected one if no client is selected yet.
 */
const { data: availableClients } = useAsyncData('availableEmbeddingsClients', () => {
  return Promise.resolve((isLoading.value = true))
    .then(async () => {
      const clients = await $tauriCommands.getEmbeddingsClients();
      selectedId.value = selectedId.value || clients[0]?.id;
      return clients;
    })
    .catch((e) => {
      message.error(`Failed to load available embeddings clients: ${errToString(e)}`);
      return null;
    })
    .finally(() => (isLoading.value = false));
});
const availableClientsUiData = computed(() => availableClients.value?.map(dbDataToUi));

/**
 * Notify the selected client changed when the id or the available clients change.
 */
watch([selectedId, availableClients], ([newClientId, clients]) => {
  emits('update:id', newClientId);
  emits(
    'update:value',
    clients?.find((client) => client.id == newClientId),
  );
});

function onCreate() {
  return Promise.resolve()
    .then(async () => {
      // todo: validate

      // update db
      const newDbConf = await $tauriCommands.createEmbeddingsClient({
        type: formState.type,
        name: formState.name,
        info: formState.info,
      });

      // update ui
      availableClients.value = [newDbConf, ...(availableClients.value || [])];
      selectedId.value = newDbConf.id;
    })
    .then(() => {
      message.info(`New ${formState.name} Embeddings Client added!`);
    })
    .catch((e) => {
      message.error(`Failed to create new embeddings client: ${errToString(e)}`);
    })
    .finally(() => (isCreating.value = false));
}

function dbDataToUi(config: EmbeddingsClientExData) {
  return {
    value: config.id,
    label: config.name,
  };
}
</script>