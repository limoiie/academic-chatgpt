import { defineStore } from 'pinia';
import { getVectorDbConfigById, GetVectorDbConfigData, upsertVectorDbConfig } from '~/utils/bindings';

export type VectorDbClientType = 'pinecone';

export const allVectorDbClients = ['pinecone'];

interface DefaultVectorDbStore {
  defaultConfigId: number;
}

const STORE_KEY = 'defaultVectorDbStore';

export const useDefaultVectorDbStore = defineStore('defaultVectorDb', () => {
  const { $tauriStore } = useNuxtApp();

  const defaultConfig = ref<GetVectorDbConfigData>({
    id: -1,
    name: 'pinecone-default',
    client: 'pinecone' as VectorDbClientType,
    meta: {},
  });

  async function loadFromLocalStore() {
    const stored = await $tauriStore.get<DefaultVectorDbStore>(STORE_KEY).then();
    if (stored == null) return false;

    const config = await getVectorDbConfigById(stored.defaultConfigId);
    config != null ? (defaultConfig.value = config) : null;
    return config != null;
  }

  async function storeToLocalStore() {
    await persistDefaultVectorDbConfig();

    await $tauriStore.set(STORE_KEY, {
      defaultConfigId: defaultConfig.value.id,
    } as DefaultVectorDbStore);

    return true;
  }

  async function persistDefaultVectorDbConfig() {
    validateStore();

    defaultConfig.value = await upsertVectorDbConfig(defaultConfig.value.id, {
      name: defaultConfig.value.name,
      client: defaultConfig.value.client,
      meta: defaultConfig.value.meta,
    });
  }

  function requireMetaStringValue(key: string) {
    if (defaultConfig.value.meta[key] == null || defaultConfig.value.meta[key].length == 0) {
      throw new Error(`Missing ${key} of vector db, please fulfill in the presets page.`);
    }
  }

  function validateStore() {
    if (defaultConfig.value.name.length == 0 || defaultConfig.value.client.length == 0) {
      throw new Error('Missing some presets about vector db, please fulfill in the presets page.');
    }

    switch (defaultConfig.value.client) {
      case 'pinecone':
        requireMetaStringValue('apiKey');
        requireMetaStringValue('environment');
        requireMetaStringValue('indexName');
        break;

      default:
        throw new Error(`Not supported vector db: ${defaultConfig.value.client}`);
    }
  }

  return {
    defaultVectorDbConfig: defaultConfig,
    loadFromLocalStore,
    storeToLocalStore,
    validateStore,
  };
});
