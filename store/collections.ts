import { message } from 'ant-design-vue';
import { defineStore } from 'pinia';
import { Ref } from 'vue';
import { Collection, CollectionIndexWithAll, IndexProfileWithAll } from '~/plugins/tauri/bindings';
import { deleteIndexFromVectorstore } from '~/utils/vectorstores';
import { useSessionStore } from "~/store/sessions";

interface CollectionPreference {
  /**
   * ID of an active collection.
   */
  activeCollectionId: Ref<number | undefined>;
  /**
   * ID of active index by collection id. Active index will be the default
   * index for future new chat sessions.
   */
  activeIndexIdByCollectionId: Map<number, Ref<string | undefined>>;
}

/**
 * The format that collection related user preferences will be persisted in.
 */
interface PersistentCollectionPreference {
  activeCollectionId: number | undefined;
  activeIndexIdByCollectionId: [number, string | undefined][];
}

const STORE_KEY = 'collectionsStore';

export const useCollectionStore = defineStore('collections', () => {
  const { $tauriStore, $tauriCommands } = useNuxtApp();
  const loaded = ref(false);

  /**
   * Collection related user preferences.
   *
   * Different from the data in database, this is about user's using habit and
   * can be deleted without losing anything.
   */
  const preferences: CollectionPreference = {
    activeCollectionId: ref<number | undefined>(undefined),
    activeIndexIdByCollectionId: new Map(),
  };

  /**
   * All collections from database.
   */
  const collections = ref<Collection[]>([]);

  /**
   * Names of all collections.
   */
  const collectionNames = computed(() => collections.value.map((c) => c.name));

  /**
   * All indexes of all collections by collection id.
   */
  const collectionIndexes = ref<Map<number, CollectionIndexWithAll[]>>(new Map());

  const sessionStore = useSessionStore();

  const route = useRoute();
  watch(route, async () => {
    await syncActiveCollectionByWatchingRoute();
  });

  /**
   * Load collections and related state from cache and database if not loaded.
   */
  async function load() {
    if (!loaded.value) {
      await loadCollectionsFromDatabase();
      await loadIndexesFromDatabase();
      await loadCacheFromTauriStore();
      loaded.value = true;
    }
  }

  /**
   * Load user preference from local store.
   */
  async function loadCacheFromTauriStore() {
    const stored = await $tauriStore.get<PersistentCollectionPreference>(STORE_KEY);
    if (stored == null) return false;
    fromPersistent(preferences, stored);

    // Set fallback collection if an active collection is not found.
    if (stored.activeCollectionId != null) {
      const active = collections.value.find((c) => c.id == stored.activeCollectionId);
      if (!active) {
        preferences.activeCollectionId.value = undefined;
      }
    }
    return true;
  }

  /**
   * Save user preference to local store.
   */
  async function storeCacheToTauriStore() {
    await $tauriStore.set(STORE_KEY, toPersistent(preferences));
    await $tauriStore.save();
    return true;
  }

  /**
   * Load all the collections from the database.
   */
  async function loadCollectionsFromDatabase() {
    collections.value = (await $tauriCommands.getCollections()) || [];
  }

  /**
   * Load all the indexes from the database.
   */
  async function loadIndexesFromDatabase() {
    const map = new Map();
    for (const collection of collections.value) {
      const indexes = await $tauriCommands.getCollectionIndexesByCollectionIdWithAll(collection.id);
      map.set(collection.id, indexes);
    }
    collectionIndexes.value = map;
  }

  /**
   * Get a collection by id.
   */
  async function getCollection(id: number) {
    return collections.value.find((c) => c.id == id);
  }

  /**
   * Get a collection with default the index profile.
   */
  async function createCollection(defaultIndexProfile: IndexProfileWithAll) {
    const newCollectionName = uniqueName('Collection', collectionNames.value);
    const collection = await $tauriCommands.createCollection({ documents: [], name: newCollectionName });
    const collectionIndex = await $tauriCommands.createCollectionIndex({
      name: defaultIndexProfile.name,
      collectionId: collection.id,
      indexId: defaultIndexProfile.id,
    });

    preferences.activeIndexIdByCollectionId.set(collection.id, ref(collectionIndex.id));
    await storeCacheToTauriStore();

    await reloadCollectionById(collection.id);
    return collection;
  }

  /**
   * Reload a collection from the database.
   *
   * Call this function whenever a collection is modified, deleted or created.
   */
  async function reloadCollectionById(id: number) {
    const all = await $tauriCommands.getCollectionsWithIndexes();
    const freshCollection = all.find((c) => c.id == id);
    const k = collections.value.findIndex((c) => c.id == id);
    if (k == -1) {
      if (freshCollection) {
        collections.value.push(freshCollection);
      }
    } else {
      if (freshCollection) {
        collections.value[k] = freshCollection;
      } else {
        collections.value = [...collections.value.slice(0, k), ...collections.value.slice(k + 1)];
      }
    }

    const indexes = await $tauriCommands.getCollectionIndexesByCollectionIdWithAll(id);
    collectionIndexes.value.set(id, indexes);
  }

  /**
   * Delete a collection by id.
   *
   * If the deleted collection is active, a fallback collection will be chosen
   * to activate.
   * This function will also:
   * - delete all the indexes of the collection;
   * - remove all the documents from the collection;
   * - remove all the vectors of the collection from the remote vectorstore;
   * - delete all the chat sessions including both the history and user
   *   preferences of the collection.
   */
  async function deleteCollectionById(collectionId: number) {
    const i = collections.value.findIndex((c) => c.id == collectionId);
    if (i == -1) return { deleted: undefined, fallback: undefined };

    // remove indexes from remote vectorstore
    const indexes = collectionIndexes.value.get(collectionId) || [];
    for (const index of indexes) {
      await deleteIndexFromVectorstore(index.index.vectorDbClient, index.index.vectorDbConfig, index.id).catch((e) =>
        message.warn(
          `Failed to delete index from vectorstore: ${errToString(e)}.` +
            `If the vectorstore from pinecone, it is safe to ignore.`,
        ),
      );
    }

    // remove sessions and related data from the cache
    await sessionStore.deleteSessionsFromCacheByIndexes(indexes);

    // delete indexes and related data from the cache
    collectionIndexes.value.delete(collectionId);
    const activeIndexId = preferences.activeIndexIdByCollectionId.get(collectionId);
    if (activeIndexId) {
      preferences.activeIndexIdByCollectionId.delete(collectionId);
      activeIndexId.value = undefined;
    }
    await storeCacheToTauriStore();

    // remove the collection with related indexes and session from the local database
    await $tauriCommands.deleteCollectionById(collectionId);
    const deleted = collections.value[i];
    collections.value = [...collections.value.slice(0, i), ...collections.value.slice(i + 1)];

    // set fallback collection if the active collection is the deleted one.
    const fallback =
      preferences.activeCollectionId.value != collectionId ? undefined : await setActiveCollectionIdByNo(i);
    return { deleted, fallback };
  }

  /**
   * Get the index of a collection by id.
   */
  function getCollectionIndexById(collectionId: number, indexProfileId: number) {
    return getCollectionIndexesByCollectionId(collectionId)?.find((c) => c.indexId == indexProfileId);
  }

  /**
   * Get all the indexes of a collection by collection id.
   */
  function getCollectionIndexesByCollectionId(collectionId: number) {
    return collectionIndexes.value.get(collectionId);
  }

  /**
   * Get the active index of a collection by collection id.
   */
  async function getActiveIndexByCollectionId(collectionid: number) {
    const existingActiveIndexId = preferences.activeIndexIdByCollectionId.get(collectionid);
    const activeIndexId = existingActiveIndexId?.value;
    if (activeIndexId) {
      const activeIndex = getCollectionIndexesByCollectionId(collectionid)?.find((c) => c.id == activeIndexId);
      if (activeIndex) return activeIndex;
    }

    // fallback to first index
    const fallbackActiveIndex = getCollectionIndexesByCollectionId(collectionid)?.[0];
    if (!fallbackActiveIndex) {
      return fallbackActiveIndex;
    }
    if (existingActiveIndexId) {
      existingActiveIndexId.value = fallbackActiveIndex.id;
    } else {
      preferences.activeIndexIdByCollectionId.set(collectionid, ref(fallbackActiveIndex.id));
    }
    await storeCacheToTauriStore();
    return fallbackActiveIndex;
  }

  /**
   * Get the active index id of a collection by collection id.
   *
   * @param collectionId ID of the collection
   */
  async function getActiveIndexIdByCollectionId(collectionId: number) {
    return (await getActiveIndexByCollectionId(collectionId))?.id;
  }

  /**
   * Set active collection by index in the array of collections.
   *
   * If no collection left, set the active collection to null.
   * If already active, return undefined.
   * Otherwise, return the active collection.
   *
   * @param no the index of the collection in collections to be set as active
   */
  async function setActiveCollectionIdByNo(no: number) {
    no = Math.min(no, collections.value.length - 1);
    const activeCollection = collections.value.at(no);
    if (!activeCollection) {
      preferences.activeCollectionId.value = undefined;
      // there is no collection left
      return null;
    }
    if (activeCollection.id == preferences.activeCollectionId.value) {
      // already active, skip
      return undefined;
    }

    preferences.activeCollectionId.value = activeCollection.id;
    await storeCacheToTauriStore();
    return activeCollection;
  }

  /**
   * Sync the active collection id from route params.
   */
  async function syncActiveCollectionByWatchingRoute() {
    const paramId = route.params.id;
    if (typeof paramId === 'string') {
      const collectionId = Number(paramId);
      if (preferences.activeCollectionId.value != collectionId) {
        preferences.activeCollectionId.value = collectionId;
        await storeCacheToTauriStore();
      }
    }
  }

  return {
    collections,
    collectionNames,
    activeCollectionId: preferences.activeCollectionId,
    collectionIndexes,
    load,
    getCollection,
    createCollection,
    reloadCollectionById,
    deleteCollectionById,
    loadIndexesFromDatabase,
    getCollectionIndexById,
    getActiveIndexByCollectionId,
    getActiveIndexIdByCollectionId,
  };
});

function toPersistent(cache: CollectionPreference) {
  return {
    activeCollectionId: cache.activeCollectionId.value,
    activeIndexIdByCollectionId: [...cache.activeIndexIdByCollectionId.entries()].map(([collectionId, indexId]) => [
      collectionId,
      indexId.value,
    ]),
  } as PersistentCollectionPreference;
}

function fromPersistent(cache: CollectionPreference, stored: PersistentCollectionPreference) {
  cache.activeCollectionId.value = stored.activeCollectionId;
  cache.activeIndexIdByCollectionId = new Map(stored.activeIndexIdByCollectionId.map(([k, v]) => [k, ref(v)]));
}
