import { defineStore, storeToRefs } from 'pinia';
import { Ref } from 'vue';
import { CollectionIndexWithAll } from '~/plugins/tauri/bindings';
import { useDefaultCompleteStore } from '~/store/defaultComplete';
import { CompletionChainModeType } from '~/types';

const STORE_KEY = 'sessionsStore';
const DEFAULT_COMPLETION_CHAIN_MODE = 'WithoutHistory';

/**
 * Session profile recoding the customization of a chat session.
 */
export interface SessionProfile {
  completionChainMode: CompletionChainModeType;
  completionConfig: CompletionConfig;
}

interface SessionPreference {
  /**
   * Mapping from a string in form of `collection-id,index-id` to active session's id.
   */
  activeSessionId: Map<string, Ref<number | undefined>>;
  /**
   * Mapping from session id to session profile.
   */
  sessionProfiles: Map<number, Ref<SessionProfile>>;
}

/**
 * The format that session related preference will be persistented in.
 */
interface PersistentSessionPreference {
  activeSessionId: [string, number | undefined][];
  sessionProfiles: [number, SessionProfile][];
}

export const useSessionStore = defineStore('sessions', () => {
  const { $tauriStore, $tauriCommands } = useNuxtApp();
  const loaded = ref(false);

  /**
   * Session related user preferences.
   */
  const preference = ref<SessionPreference>({
    activeSessionId: new Map(),
    sessionProfiles: new Map(),
  });

  const defaultCompletionStore = useDefaultCompleteStore();
  const { defaultCompleteConfig } = storeToRefs(defaultCompletionStore);

  /**
   * Default session profile for future new session.
   */
  const defaultSessionProfile = computed(() => {
    return {
      completionChainMode: DEFAULT_COMPLETION_CHAIN_MODE,
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
    const persistent = await $tauriStore.get<PersistentSessionPreference>(STORE_KEY);
    if (persistent == null) return false;
    fromPersistent(preference.value, persistent);
    return true;
  }

  async function storeCacheToTauriStore() {
    await $tauriStore.set(STORE_KEY, toPersistent(preference.value));
    await $tauriStore.save();
    return true;
  }

  function getSessionProfile(sessionId: number) {
    return _getSessionProfile(sessionId);
  }

  function _getSessionProfile(sessionId: number) {
    if (!preference.value.sessionProfiles.has(sessionId)) {
      const data = ref<SessionProfile>(JSON.parse(JSON.stringify(defaultSessionProfile.value)));
      preference.value.sessionProfiles.set(sessionId, data);
      watch(preference.value.sessionProfiles.get(sessionId)!, async () => {
        await storeCacheToTauriStore();
      });
    }
    return preference.value.sessionProfiles.get(sessionId)!;
  }

  /**
   * Get the active session id for the given collection and index.
   *
   * Watch the change of the active session id to persist the preference to tauri store.
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
   * Watch the change of the active session id to persist the preference to tauri store.
   *
   * @param key The key in the form of `${collectionId},${indexId}` of the active session.
   */
  function _getActiveSessionId(key: string) {
    if (!preference.value.activeSessionId.has(key)) {
      const data = ref<number | undefined>(undefined);
      preference.value.activeSessionId.set(key, data);
      watch(preference.value.activeSessionId.get(key)!, async () => {
        await storeCacheToTauriStore();
      });
    }
    return preference.value.activeSessionId.get(key)!;
  }

  /**
   * Delete all the sessions of the given indexes from the cache.
   * This function wouldn't delete the sessions from the database.
   *
   * @param indexes The indexes whose sessions are going to be removed.
   */
  async function deleteSessionsFromCacheByIndexes(indexes: CollectionIndexWithAll[]) {
    for (const index of indexes) {
      await deleteSessionsFromCacheByIndex(index);
    }
  }

  /**
   * Delete all the sessions of the given index from the cache.
   * This function wouldn't delete the sessions from the database.
   *
   * @param index The index whose sessions are going to be removed.
   */
  async function deleteSessionsFromCacheByIndex(index: CollectionIndexWithAll) {
    const sessions = await $tauriCommands.getSessionsByIndexId(index.id);
    const sessionIds = sessions.map((s) => s.id);

    // delete all the sessions of the given index
    for (const [sessionId, _] of preference.value.sessionProfiles) {
      if (sessionIds.includes(sessionId)) {
        preference.value.sessionProfiles.delete(sessionId);
      }
    }

    // delete the active session of the given index
    for (const [indexId, activeSessionId] of preference.value.activeSessionId) {
      if (indexId == index.id) {
        activeSessionId.value = undefined;
        preference.value.activeSessionId.delete(indexId);
        break;
      }
    }
  }

  /**
   * Delete the session from the cache and database.
   *
   * @param sessionId
   */
  async function deleteSession(sessionId: number) {
    preference.value.sessionProfiles.delete(sessionId);
    await $tauriCommands.deleteSessionById(sessionId);
  }

  function toPersistent(preference: SessionPreference): PersistentSessionPreference {
    return {
      activeSessionId: [...preference.activeSessionId.entries()].map(([k, v]) => [k, v.value]),
      sessionProfiles: [...preference.sessionProfiles.entries()].map(([k, v]) => [k, v.value]),
    };
  }

  function fromPersistent(preference: SessionPreference, persistent: PersistentSessionPreference) {
    preference.activeSessionId = new Map();
    preference.sessionProfiles = new Map(persistent.sessionProfiles.map(([k, v]) => [k, ref(v)]));

    for (const [key, value] of persistent.activeSessionId) {
      _getActiveSessionId(key).value = value;
    }
  }

  return {
    load,
    getActiveSessionId,
    getSessionProfile,
    deleteSession,
    deleteSessionsFromCacheByIndexes,
  };
});
