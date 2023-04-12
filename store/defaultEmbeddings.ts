import { defineStore } from 'pinia';
import {
  getEmbeddingsClientById,
  GetEmbeddingsClientData,
  getEmbeddingsConfigById,
  GetEmbeddingsConfigData,
  upsertEmbeddingsClient,
  upsertEmbeddingsConfig,
} from '~/utils/bindings';

export type EmbeddingsClientType = 'openai';

interface DefaultEmbeddingsStore {
  defaultClientId: number;
  defaultConfigId: number;
}

const STORE_KEY = 'defaultEmbeddingsStore';

export const useDefaultEmbeddingsStore = defineStore('defaultEmbeddings', () => {
  const { $tauriStore } = useNuxtApp();

  const defaultClient = ref<GetEmbeddingsClientData>({
    id: -1,
    name: 'openai-defaultUser',
    type: 'openai' as EmbeddingsClientType,
    info: {},
  });
  const defaultConfig = ref<GetEmbeddingsConfigData>({
    id: -1,
    name: 'openai-defaultConfig',
    client_type: 'openai' as EmbeddingsClientType,
    meta: {},
  });

  async function loadFromLocalStore() {
    const stored = await $tauriStore.get<DefaultEmbeddingsStore>(STORE_KEY);
    if (stored) {
      const client = await getEmbeddingsClientById(stored.defaultClientId);
      const config = await getEmbeddingsConfigById(stored.defaultConfigId);
      client != null ? (defaultClient.value = client) : null;
      config != null ? (defaultConfig.value = config) : null;
      return client != null && config != null;
    }
    return false;
  }

  async function storeToLocalStore() {
    await persistDefaultEmbeddingsClientAndConfig();
    await $tauriStore.set(STORE_KEY, {
      defaultClientId: defaultClient.value.id,
      defaultConfigId: defaultConfig.value.id,
    } as DefaultEmbeddingsStore);
    return true;
  }

  async function persistDefaultEmbeddingsClientAndConfig() {
    validateStore();
    defaultClient.value = await upsertEmbeddingsClient(defaultClient.value.id, {
      name: defaultClient.value.name,
      type: defaultClient.value.type,
      info: defaultClient.value.info,
    });

    defaultConfig.value = await upsertEmbeddingsConfig(defaultConfig.value.id, {
      name: defaultConfig.value.name,
      client_type: defaultConfig.value.client_type,
      meta: defaultConfig.value.meta,
    });
  }

  function validateStore() {
    if (defaultConfig.value.client_type != defaultClient.value.type) {
      throw new Error('The client_type of defaultConfig should be consistent with the type of defaultClient.');
    }
  }

  return {
    defaultEmbeddingsClient: defaultClient,
    defaultEmbeddingsConfig: defaultConfig,
    loadFromLocalStore,
    storeToLocalStore,
    validateStore,
  };
});
