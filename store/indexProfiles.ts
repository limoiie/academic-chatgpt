import { defineStore } from 'pinia';
import { Ref } from 'vue';
import {
  createIndexProfile,
  CreateIndexProfileData,
  EmbeddingsClientExData,
  GetEmbeddingsConfigData,
  IndexProfile,
  VectorDbClientExData,
  VectorDbConfigExData,
} from '~/utils/bindings';

interface IndexProfilesStore {
  defaultIndexProfileId: number | undefined;
}

const STORE_KEY = 'indexProfilesStore';

export const useIndexProfilesStore = defineStore('indexProfiles', () => {
  const { $tauriStore } = useNuxtApp();

  const loaded = ref(false);

  const cache = ref<IndexProfilesStore>({
    defaultIndexProfileId: undefined,
  });
  const indexProfiles: Ref<IndexProfile[]> = ref([]);
  const indexProfileNames = computed(() => indexProfiles.value.map((c) => c.name));
  const defaultIndexProfile = computed(() => {
    if (cache.value.defaultIndexProfileId == null) return undefined;
    return indexProfiles.value.find((c) => c.id === cache.value.defaultIndexProfileId);
  });

  /**
   * Load index profiles and related state from cache and database if not loaded.
   *
   * @param force If true, force to load index profiles from database.
   */
  async function load(force: boolean = false) {
    if (force || !loaded.value) {
      await loadDataFromDatabase();
      await loadCacheFromTauriStore();
      loaded.value = true;
    }
  }

  async function loadDataFromDatabase() {
    indexProfiles.value = (await getIndexProfiles()) || [];
  }

  /**
   * Load default index profile from local store.
   *
   * @returns true if default index profile is loaded successfully, false otherwise.
   */
  async function loadCacheFromTauriStore() {
    const stored = await $tauriStore.get<IndexProfilesStore>(STORE_KEY);
    cache.value = stored || {
      defaultIndexProfileId: undefined,
    };
    if (cache.value.defaultIndexProfileId == null && indexProfiles.value.length > 0) {
      cache.value.defaultIndexProfileId = indexProfiles.value[0].id;
      await storeCacheToTauriStore();
    }
  }

  async function storeCacheToTauriStore() {
    await $tauriStore.set(STORE_KEY, cache);
    $tauriStore.save();
    return true;
  }

  async function upsertDefaultIndexProfile(
    embeddingsClient: EmbeddingsClientExData,
    embeddingsConfig: GetEmbeddingsConfigData,
    vectorDbClient: VectorDbClientExData,
    vectorDbConfig: VectorDbConfigExData,
    name: string = '',
  ) {
    function isNotChanged(indexProfile: IndexProfile) {
      // todo: check if the name is the same
      return (
        // indexProfile.splittingId === splittingId &&
        indexProfile.embeddingsClientId === embeddingsClient.id &&
        indexProfile.embeddingsConfigId === embeddingsConfig.id &&
        indexProfile.vectorDbClientId === vectorDbClient.id &&
        indexProfile.vectorDbConfigId === vectorDbConfig.id
      );
    }

    const defaultIndexProfile = indexProfiles.value.find((c) => c.id === cache.value.defaultIndexProfileId);
    if (defaultIndexProfile && isNotChanged(defaultIndexProfile)) {
      // Default index profile is already set and not changed, skip.
      return;
    }

    const data = {
      name: name || defaultIndexProfile?.name || '',
      splittingId: defaultIndexProfile?.splittingId || -1,
      embeddingsClientId: embeddingsClient.id,
      embeddingsConfigId: embeddingsConfig.id,
      vectorDbClientId: vectorDbClient.id,
      vectorDbConfigId: vectorDbConfig.id,
    } as CreateIndexProfileData;

    await ensureCreateIndexProfileData(data, embeddingsClient, vectorDbClient);
    const newIndexProfile = await createIndexProfile(data);
    indexProfiles.value.push(newIndexProfile);
    cache.value.defaultIndexProfileId = newIndexProfile.id;
  }

  /**
   * Ensure that the data is valid for creating index profile.
   *
   * If the data is not valid, throw an error. Otherwise, if the data is valid
   * but some fields are not set, set them to default values.
   */
  async function ensureCreateIndexProfileData(
    data: CreateIndexProfileData,
    embeddingsClient: EmbeddingsClientExData,
    vectorDbClient: VectorDbClientExData,
  ) {
    if (data.name.length === 0) {
      data.name = `${embeddingsClient.name}-${vectorDbClient.name}`;
    }

    if (data.splittingId === -1) {
      const splitting = await getOrCreateSplitting({
        chunkOverlap: 200,
        chunkSize: 1000,
      });
      data.splittingId = splitting.id;
    }

    validateCreateIndexProfileData(data);
  }

  function validateCreateIndexProfileData(indexProfile: CreateIndexProfileData) {
    if (
      indexProfile.splittingId === -1 ||
      indexProfile.embeddingsClientId === -1 ||
      indexProfile.embeddingsConfigId === -1 ||
      indexProfile.vectorDbClientId === -1 ||
      indexProfile.vectorDbConfigId === -1
    ) {
      throw new Error('Default index profile is not completed.');
    }
  }

  return {
    indexProfiles,
    indexProfileNames,
    defaultIndexProfile,
    load,
    storeCacheToTauriStore,
    upsertDefaultIndexProfile,
  };
});
