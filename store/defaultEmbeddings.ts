import { defineStore } from 'pinia';
import { EmbeddingsClientExData, EmbeddingsConfigExData } from '~/plugins/tauri/bindings';

export type EmbeddingsClientType = 'openai';

interface DefaultEmbeddingsStore {
  defaultClientId: number;
  defaultConfigId: number;
}

const STORE_KEY = 'defaultEmbeddingsStore';

export const useDefaultEmbeddingsStore = defineStore('defaultEmbeddings', () => {
  const { $tauriStore, $tauriCommands } = useNuxtApp();

  const defaultClient = ref<EmbeddingsClientExData>({
    id: -1,
    name: 'openai',
    type: 'openai' as EmbeddingsClientType,
    info: {},
  });
  const defaultConfig = ref<EmbeddingsConfigExData>({
    id: -1,
    name: 'openai',
    clientType: 'openai' as EmbeddingsClientType,
    meta: {},
  });

  async function load() {
    const stored = await $tauriStore.get<DefaultEmbeddingsStore>(STORE_KEY);
    if (stored) {
      const client = await $tauriCommands.getEmbeddingsClientById(stored.defaultClientId);
      const config = await $tauriCommands.getEmbeddingsConfigById(stored.defaultConfigId);
      client != null ? (defaultClient.value = client) : null;
      config != null ? (defaultConfig.value = config) : null;
      return client != null && config != null;
    }
    return false;
  }

  async function store() {
    await persistDefaultEmbeddingsClientAndConfig();
    await $tauriStore.set(STORE_KEY, {
      defaultClientId: defaultClient.value.id,
      defaultConfigId: defaultConfig.value.id,
    } as DefaultEmbeddingsStore);
    $tauriStore.save();
    return true;
  }

  async function persistDefaultEmbeddingsClientAndConfig() {
    validateStore();
    defaultClient.value = await $tauriCommands.upsertEmbeddingsClient(defaultClient.value.id, {
      name: defaultClient.value.name,
      type: defaultClient.value.type,
      info: defaultClient.value.info,
    });
    defaultConfig.value = await $tauriCommands.upsertEmbeddingsConfig(defaultConfig.value.id, {
      name: defaultConfig.value.name,
      clientType: defaultConfig.value.clientType,
      meta: defaultConfig.value.meta,
    });
  }

  function validateStore() {
    if (defaultConfig.value.clientType != defaultClient.value.type) {
      throw new Error(
        `Client type ${defaultClient.value.type} does not match config type ${defaultConfig.value.clientType}`,
      );
    }
  }

  return {
    defaultEmbeddingsClient: defaultClient,
    defaultEmbeddingsConfig: defaultConfig,
    load,
    store,
    validateStore,
  };
});
