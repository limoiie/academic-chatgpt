import { defineStore } from 'pinia';

interface AppSettingsStore {
  username: string;
}

interface PersistentAppSettingsStore {
  username: string;
}

const STORE_KEY = 'appSettings';
const DEFAULT_USERNAME = 'ME';

export const useAppSettingsStore = defineStore(STORE_KEY, () => {
  const { $tauriStore } = useNuxtApp();

  const loaded = ref(false);
  const cache = ref<AppSettingsStore>({
    username: DEFAULT_USERNAME,
  });

  async function load() {
    if (loaded.value) return true;

    const stored = await $tauriStore.get<PersistentAppSettingsStore>(STORE_KEY);
    if (stored == null) return false;
    fromPersistent(cache.value, stored);

    loaded.value = true;
    return true;
  }

  async function storeCacheToTauriStore() {
    await $tauriStore.set(STORE_KEY, toPersistent(cache.value));
    await $tauriStore.save();
    return true;
  }

  function toPersistent(preference: AppSettingsStore): PersistentAppSettingsStore {
    return {
      username: preference.username || DEFAULT_USERNAME,
    } as PersistentAppSettingsStore;
  }

  function fromPersistent(preference: AppSettingsStore, persistent: PersistentAppSettingsStore) {
    preference.username = persistent.username || DEFAULT_USERNAME;
  }

  return {
    appSettings: cache,
    load,
    storeCacheToTauriStore,
  };
});
