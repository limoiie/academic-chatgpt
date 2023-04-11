import { defineStore } from 'pinia';

export type VectorDbClientType = 'pinecone';

export const allVectorDbClients = ['pinecone'];

interface DefaultVectorDbStore {
  defaultClient: VectorDbClientType;
  defaultApiKey: string;
  defaultMeta: Record<string, any>;
}

export const useDefaultVectorDbStore = defineStore('defaultVectorDb', () => {
  const { $tauriStore } = useNuxtApp();

  const defaultClient = ref<VectorDbClientType | undefined>('pinecone');
  const defaultApiKey = ref<string | undefined>(undefined);
  const defaultMeta = ref<any | undefined>({});

  async function loadFromLocalStore() {
    const stored = await $tauriStore.get<DefaultVectorDbStore>('defaultVectorDbStore');
    if (stored) {
      defaultClient.value = stored.defaultClient;
      defaultApiKey.value = stored.defaultApiKey;
      defaultMeta.value = stored.defaultMeta;
      return true;
    }
    return false;
  }

  async function storeToLocalStore() {
    await $tauriStore.set('defaultVectorDbStore', {
      defaultClient: defaultClient.value,
      defaultApiKey: defaultApiKey.value,
      defaultMeta: defaultMeta.value,
    } as DefaultVectorDbStore);
    return true;
  }

  return {
    defaultVectorDbClient: defaultClient,
    defaultVectorDbApiKey: defaultApiKey,
    defaultVectorDbMeta: defaultMeta,
    loadFromLocalStore,
    storeToLocalStore,
  };
});
