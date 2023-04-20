import { defineStore } from 'pinia';
import { Ref } from 'vue';

const STORE_KEY = 'sessionsStore';

interface SessionProfile {
  id: number;
  chainMode: string;
}

interface SessionsStore {
  activeSessionId: Map<string, Ref<number | undefined>>;
}

interface PersistentSessionsStore {
  activeSessionId: [[string, number | undefined]];
}

export const useSessionsStore = defineStore('sessions', () => {
  const { $tauriStore } = useNuxtApp();
  const loaded = ref(false);
  const cache = ref<SessionsStore>({
    activeSessionId: new Map(),
  });

  async function load() {
    if (!loaded.value) {
      await loadCacheFromTauriStore();
      loaded.value = true;
    }
  }

  async function loadCacheFromTauriStore() {
    const stored = await $tauriStore.get<PersistentSessionsStore>(STORE_KEY);
    if (stored == null) return false;
    cache.value = {
      ...stored,
      activeSessionId: new Map(),
    };
    for (const [key, value] of stored.activeSessionId) {
      _getActiveSessionId(key).value = value;
    }
    return true;
  }

  async function storeCacheToTauriStore() {
    await $tauriStore.set(STORE_KEY, {
      ...cache.value,
      activeSessionId: [...cache.value.activeSessionId.entries()].map(([k, v]) => [k, v.value]),
    } as PersistentSessionsStore);
    await $tauriStore.save();
    return true;
  }

  function getActiveSessionId(collectionId: number, indexId: number) {
    return _getActiveSessionId(`${collectionId},${indexId}`);
  }

  function _getActiveSessionId(key: string) {
    if (!cache.value.activeSessionId.has(key)) {
      const data = ref<number | undefined>(undefined);
      cache.value.activeSessionId.set(key, data);
      watch(cache.value.activeSessionId.get(key)!, async () => {
        await storeCacheToTauriStore();
      });
    }
    return cache.value.activeSessionId.get(key)!;
  }

  return {
    load,
    getActiveSessionId,
  };
});
