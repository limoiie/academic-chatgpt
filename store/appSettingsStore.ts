import { ColorModeInstance } from '@nuxtjs/color-mode/dist/runtime/types';
import { defineStore } from 'pinia';

interface AppSettingsStore {
  colorMode: ColorModeInstance;
}

interface PersistentAppSettingsStore {
  colorMode: string;
}

const STORE_KEY = 'appSettings';
export const useAppSettingsStore = defineStore(STORE_KEY, () => {
  const { $tauriStore } = useNuxtApp();

  const cache = ref<AppSettingsStore>({
    colorMode: useColorMode(),
  });
  cache.value.colorMode.value = 'light';
  watch(() => cache.value.colorMode.value, async (newColorMode, oldColorMode) => {
    if (newColorMode == 'theme') {
      // fixme: strange.. don't know who is changing the value as 'theme'
      cache.value.colorMode.value = oldColorMode;
      return;
    }

    await storeCacheToTauriStore();
  }, {
    deep: true,
  });

  async function load() {
    const stored = await $tauriStore.get<PersistentAppSettingsStore>(STORE_KEY);
    if (stored == null) return false;
    cache.value = {
      ...stored,
      colorMode: cache.value.colorMode,
    };
    cache.value.colorMode.value = stored.colorMode;
    console.log('load', cache.value.colorMode.value, stored.colorMode)

    return true;
  }

  async function storeCacheToTauriStore() {
    await $tauriStore.set(STORE_KEY, {
      ...cache.value,
      colorMode: cache.value.colorMode.value
    } as PersistentAppSettingsStore);
    await $tauriStore.save();
    return true;
  }

  return {
    appSettings: cache,
    load,
    storeCacheToTauriStore,
  };
});
