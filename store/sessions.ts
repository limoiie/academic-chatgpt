import { defineStore, storeToRefs } from 'pinia';
import { Ref } from 'vue';
import { useDefaultCompleteStore } from '~/store/defaultComplete';
import { CompletionChainModeType } from '~/types';

const STORE_KEY = 'sessionsStore';
const DEFAULT_COMPLETION_CHAIN_MODE = 'WithoutHistory';

export interface SessionProfile {
  completionChainMode: CompletionChainModeType;
  completionConfig: CompletionConfig;
}

interface SessionsStore {
  activeSessionId: Map<string, Ref<number | undefined>>;
  sessionProfiles: Map<number, Ref<SessionProfile>>;
}

interface PersistentSessionsStore {
  activeSessionId: [string, number | undefined][];
  sessionProfiles: [number, SessionProfile][];
}

export const useSessionsStore = defineStore('sessions', () => {
  const { $tauriStore } = useNuxtApp();
  const loaded = ref(false);
  const cache = ref<SessionsStore>({
    activeSessionId: new Map(),
    sessionProfiles: new Map(),
  });

  const defaultCompletionStore = useDefaultCompleteStore();
  const { defaultCompleteConfig } = storeToRefs(defaultCompletionStore);
  const defaultSessionProfile = computed(() => {
    return { completionChainMode: DEFAULT_COMPLETION_CHAIN_MODE,
      completionConfig: defaultCompleteConfig.value,
    };
  });

  async function load() {
    await defaultCompletionStore.load();
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
      sessionProfiles: new Map(stored.sessionProfiles.map(([k, v]) => [k, ref(v)])),
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
      sessionProfiles: [...cache.value.sessionProfiles.entries()].map(([k, v]) => [k, v.value]),
    } as PersistentSessionsStore);
    await $tauriStore.save();
    return true;
  }

  function getSessionProfile(sessionId: number) {
    return _getSessionProfile(sessionId);
  }

  function _getSessionProfile(sessionId: number) {
    if (!cache.value.sessionProfiles.has(sessionId)) {
      const data = ref<SessionProfile>(JSON.parse(JSON.stringify(defaultSessionProfile.value)));
      cache.value.sessionProfiles.set(sessionId, data);
      watch(cache.value.sessionProfiles.get(sessionId)!, async () => {
        await storeCacheToTauriStore();
      });
    }
    return cache.value.sessionProfiles.get(sessionId)!;
  }

  /**
   * Get the active session id for the given collection and index.
   *
   * Watch the change of the active session id to persist the cache to tauri store.
   *
   * @param collectionId
   * @param indexId
   */
  function getActiveSessionId(collectionId: number, indexId: number) {
    return _getActiveSessionId(`${collectionId},${indexId}`);
  }

  /**
   * Get the active session id for the given collection and index.
   *
   * Watch the change of the active session id to persist the cache to tauri store.
   *
   * @param key The key in the form of `${collectionId},${indexId}` of the active session.
   */
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
    getSessionProfile,
  };
});
