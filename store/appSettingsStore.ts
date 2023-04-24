import { ColorModeInstance } from '@nuxtjs/color-mode/dist/runtime/types';
import { defineStore } from 'pinia';

interface AppSettingsStore {
  colorMode: ColorModeInstance;
  username: string;
}

interface PersistentAppSettingsStore {
  colorMode: string;
  username: string;
}

const STORE_KEY = 'appSettings';
const DEFAULT_USERNAME = 'ME';

export const useAppSettingsStore = defineStore(STORE_KEY, () => {
  const { $tauriStore } = useNuxtApp();

  const loaded = ref(false);
  const cache = ref<AppSettingsStore>({
    colorMode: useColorMode(),
    username: DEFAULT_USERNAME,
  });
  cache.value.colorMode.preference = 'light';
  watch(() => cache.value.colorMode.preference, storeCacheToTauriStore);

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
      colorMode: preference.colorMode.preference,
      username: preference.username || DEFAULT_USERNAME,
    } as PersistentAppSettingsStore;
  }

  function fromPersistent(preference: AppSettingsStore, persistent: PersistentAppSettingsStore) {
    preference.colorMode.preference = persistent.colorMode;
    preference.username = persistent.username || DEFAULT_USERNAME;
  }

  return {
    appSettings: cache,
    load,
    storeCacheToTauriStore,
  };
});
