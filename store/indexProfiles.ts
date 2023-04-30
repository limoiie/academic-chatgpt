import { defineStore } from 'pinia';
import { Ref } from 'vue';
import {
  CreateIndexProfileData,
  EmbeddingsClientExData,
  EmbeddingsConfigExData,
  IndexProfile,
  IndexProfileWithAll,
  VectorDbClientExData,
  VectorDbConfigExData,
} from '~/plugins/tauri/bindings';

interface IndexProfilesPreference {
  defaultIndexProfileId: Ref<number | undefined>;
}

interface PersistentIndexProfilesPreference {
  defaultIndexProfileId: number | undefined;
}

const STORE_KEY = 'indexProfilesStore';

export const useIndexProfileStore = defineStore('indexProfiles', () => {
  const { $tauriStore, $tauriCommands } = useNuxtApp();

  const loaded = ref(false);

  const preference: IndexProfilesPreference = {
    defaultIndexProfileId: ref(undefined),
  };
  const indexProfiles: Ref<IndexProfileWithAll[]> = ref([]);
  const indexProfileNames = computed(() => indexProfiles.value.map((c) => c.name));
  const defaultIndexProfile = computed(() => {
    if (preference.defaultIndexProfileId.value == null) return undefined;
    return indexProfiles.value.find((c) => c.id === preference.defaultIndexProfileId.value);
  });

  /**
   * Load index profiles and related state from cache and database if not loaded.
   *
   * @param force If true, force to load index profiles from the database.
   */
  async function load(force: boolean = false) {
    if (force || !loaded.value) {
      await loadDataFromDatabase();
      await loadCacheFromTauriStore();
      loaded.value = true;
    }
  }

  async function loadDataFromDatabase() {
    indexProfiles.value = (await $tauriCommands.getIndexProfilesWithAll()) || [];
  }

  /**
   * Load default index profile from local store.
   *
   * @returns true if default index profile is loaded successfully, false otherwise.
   */
  async function loadCacheFromTauriStore() {
    const stored = await $tauriStore.get<PersistentIndexProfilesPreference>(STORE_KEY);
    fromPersistent(preference, stored);

    if (preference.defaultIndexProfileId.value == null && indexProfiles.value.length > 0) {
      preference.defaultIndexProfileId.value = indexProfiles.value[0].id;
      await storeCacheToTauriStore();
    }
  }

  async function storeCacheToTauriStore() {
    await $tauriStore.set(STORE_KEY, toPersistent(preference));
    $tauriStore.save();
    return true;
  }

  async function upsertDefaultIndexProfile(
    embeddingsClient: EmbeddingsClientExData,
    embeddingsConfig: EmbeddingsConfigExData,
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

    const defaultIndexProfile = indexProfiles.value.find((c) => c.id === preference.defaultIndexProfileId.value);
    if (defaultIndexProfile && isNotChanged(defaultIndexProfile)) {
      // The default index profile is already set and not changed, skip.
      return;
    }

    await addIndexProfile(
      defaultIndexProfile?.splittingId || -1,
      embeddingsClient,
      embeddingsConfig,
      vectorDbClient,
      vectorDbConfig,
      name,
    );
  }

  async function addIndexProfile(
    splittingId: number,
    embeddingsClient: EmbeddingsClientExData,
    embeddingsConfig: EmbeddingsConfigExData,
    vectorDbClient: VectorDbClientExData,
    vectorDbConfig: VectorDbConfigExData,
    name: string = '',
  ) {
    const data = {
      name: name || '',
      splittingId: splittingId,
      embeddingsClientId: embeddingsClient.id,
      embeddingsConfigId: embeddingsConfig.id,
      vectorDbClientId: vectorDbClient.id,
      vectorDbConfigId: vectorDbConfig.id,
    } as CreateIndexProfileData;

    await ensureCreateIndexProfileData(data, embeddingsClient, vectorDbClient);
    const newIndexProfile = await $tauriCommands.createIndexProfileWithAll(data);
    indexProfiles.value.push(newIndexProfile);
    preference.defaultIndexProfileId.value = newIndexProfile.id;
    return newIndexProfile;
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
      const splitting = await $tauriCommands.getOrCreateSplitting({
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
    addIndexProfile,
  };
});

function toPersistent(store: IndexProfilesPreference): PersistentIndexProfilesPreference {
  return {
    defaultIndexProfileId: store.defaultIndexProfileId.value,
  };
}

function fromPersistent(cache: IndexProfilesPreference, store: PersistentIndexProfilesPreference | null) {
  cache.defaultIndexProfileId.value = store?.defaultIndexProfileId;
}
