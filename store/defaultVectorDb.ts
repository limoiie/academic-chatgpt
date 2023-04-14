import { defineStore } from 'pinia';
import { VectorDbClientExData, VectorDbConfigExData } from '~/utils/bindings';

export type VectorDbClientType = 'pinecone';

export const allVectorDbClients = ['pinecone'];

interface DefaultVectorDbStore {
  defaultClientId: number;
  defaultConfigId: number;
}

const STORE_KEY = 'defaultVectorDbStore';

/**
 * Default VectorDBStore.
 *
 * VectorDb is mostly used for indexing and searching documents or documents
 * chunks. This default config for VectorDbStore is used when user does not
 * provide any VectorDbConfig.
 */
export const useDefaultVectorDbStore = defineStore('defaultVectorDb', () => {
  const { $tauriStore } = useNuxtApp();

  /**
   * Default VectorDBClient.
   *
   * VectorDbClient contains necessary information (such as client kind, apiKey,
   * environments, etc.) to connect to a vector db.
   */
  const defaultClient = ref<VectorDbClientExData>({
    id: -1,
    name: 'pinecone',
    type: 'pinecone' as VectorDbClientType,
    info: {
      apiKey: '',
      environment: '',
      indexName: '',
    },
  });

  /**
   * Default VectorDBConfig.
   *
   * VectorDbConfig contains information (such as metrics, dimension, etc.) to
   * define how a vector db should behave.
   */
  const defaultConfig = ref<VectorDbConfigExData>({
    id: -1,
    name: 'pinecone',
    clientType: 'pinecone' as VectorDbClientType,
    meta: {
      metrics: 'cosine',
      dimension: 1536,
    },
  });

  /**
   * Load default VectorDBClient and VectorDBConfig from local store.
   *
   * The default VectorDBClient and VectorDBConfig are stored in two places:
   * 1. the lightweight tauri store, where persists the ids; and
   * 2. database, where persists the completed data.
   *
   * @returns true if both VectorDBClient and VectorDBConfig are loaded
   */
  async function loadFromLocalStore() {
    const stored = await $tauriStore.get<DefaultVectorDbStore>(STORE_KEY).then();
    if (stored == null) return false;

    const client = await getVectorDbClientById(stored.defaultClientId);
    const config = await getVectorDbConfigById(stored.defaultConfigId);
    client != null ? (defaultClient.value = client) : null;
    config != null ? (defaultConfig.value = config) : null;
    return client != null && config != null;
  }

  async function storeToLocalStore() {
    await persistDefaultVectorDbConfig();
    await $tauriStore.set(STORE_KEY, {
      defaultClientId: defaultClient.value.id,
      defaultConfigId: defaultConfig.value.id,
    } as DefaultVectorDbStore);
    await $tauriStore.save();
    return true;
  }

  async function persistDefaultVectorDbConfig() {
    validateStore();

    defaultClient.value = await upsertVectorDbClient(defaultClient.value.id, {
      name: defaultClient.value.name,
      type: defaultClient.value.type,
      info: defaultClient.value.info,
    });
    defaultConfig.value = await upsertVectorDbConfig(defaultConfig.value.id, {
      name: defaultConfig.value.name,
      clientType: defaultConfig.value.clientType,
      meta: defaultConfig.value.meta,
    });
  }

  function requireClientInfoStringValue(key: string) {
    const value = defaultClient.value.info[key];
    if (value == null || value.length == 0) {
      throw new Error(`Missing ${key} of vector db, please fulfill in the presets page.`);
    }
  }

  function validateStore() {
    if (defaultClient.value.type != defaultConfig.value.clientType) {
      throw new Error(`Client type mismatch: ${defaultClient.value.type} != ${defaultConfig.value.clientType}`);
    }

    if (defaultConfig.value.name.length == 0 || defaultConfig.value.clientType.length == 0) {
      throw new Error('Missing some presets about vector db, please fulfill in the presets page.');
    }

    switch (defaultConfig.value.clientType) {
      case 'pinecone':
        requireClientInfoStringValue('apiKey');
        requireClientInfoStringValue('environment');
        requireClientInfoStringValue('indexName');
        break;

      default:
        throw new Error(`Not supported vector db: ${defaultConfig.value.clientType}`);
    }
  }

  return {
    defaultVectorDbClient: defaultClient,
    defaultVectorDbConfig: defaultConfig,
    loadFromLocalStore,
    storeToLocalStore,
    validateStore,
  };
});
