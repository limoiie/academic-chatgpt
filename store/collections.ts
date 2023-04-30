import { defineStore, storeToRefs } from 'pinia';
import { ref, Ref, WatchStopHandle } from 'vue';
import {
  Collection,
  CollectionIndexWithAll,
  createCollectionIndex,
  IndexProfileWithAll,
} from '~/plugins/tauri/bindings';
import { useIndexProfileStore } from '~/store/indexProfiles';
import { useSessionStore } from '~/store/sessions';
import { deleteIndexFromVectorstore } from '~/utils/vectorstores';

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

  const sessionStore = useSessionStore();
  const indexProfileStore = useIndexProfileStore();

  const route = useRoute();
  watch(route, async () => {
    await syncActiveCollectionByWatchingRoute();
  });

  /**
   * Load collections and related state from cache and database if not loaded.
   */
  async function load() {
    await sessionStore.load();
    await indexProfileStore.load();

    if (!loaded.value) {
      await loadCollectionsFromDatabase();
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
    const indexes = await $tauriCommands.getCollectionIndexesByCollectionIdWithAll(collectionId);
    await deleteCollectionIndexes(indexes);

    // delete indexes and related data from the cache
    const activeIndexId = preferences.activeIndexIdByCollectionId.get(collectionId);
    if (activeIndexId) {
      preferences.activeIndexIdByCollectionId.delete(collectionId);
      activeIndexId.value = undefined;
    }
    await storeCacheToTauriStore();

    // remove the collection with all related indexes and sessions from the local database
    await $tauriCommands.deleteCollectionById(collectionId);
    const deleted = collections.value[i];
    collections.value = collections.value.filter((c) => c.id != collectionId);

    // set fallback collection if the active collection is the deleted one.
    const fallback =
      preferences.activeCollectionId.value != collectionId ? undefined : await setActiveCollectionIdByNo(i);
    return { deleted, fallback };
  }

  function useCollectionIndexes(collectionId: number) {
    const indexes: Ref<CollectionIndexWithAll[]> = ref([]);
    const { indexProfiles } = storeToRefs(indexProfileStore);

    const activeIndexId = getActiveIndexIdByCollectionId(collectionId);
    const activeIndex = computed(() => indexes.value.find((i) => i.id == activeIndexId.value));

    const handle: WatchStopHandle = watch(
      [indexProfiles],
      async () => {
        await syncCollectionIndexesWithIndexProfiles();
      },
      {
        immediate: true,
      },
    );

    onUnmounted(() => {
      handle?.();
    });

    /**
     * Sync the indexes of this collection with the index profiles.
     *
     * Maintain the one-to-one mapping between the indexes of this collection and the index profiles:
     * - if there is an index profile but no index for this collection, a new index will be created.
     * - if an index profile is deleted, the corresponding index of this collection will be deleted.
     */
    async function syncCollectionIndexesWithIndexProfiles() {
      const currIndexes = await $tauriCommands.getCollectionIndexesByCollectionIdWithAll(collectionId);

      // create the missing indexes
      const toCreated = indexProfiles.value.filter((indexProfile) => {
        return !currIndexes.find((index) => {
          return index.indexId == indexProfile.id;
        });
      });
      for (const indexProfile of toCreated) {
        await createCollectionIndex({
          name: indexProfile.name,
          collectionId: collectionId,
          indexId: indexProfile.id,
        });
      }

      // delete indexes for those index profiles have gone
      const toDeleted = currIndexes.filter((index) => {
        return !indexProfiles.value.find((indexProfile) => {
          return indexProfile.id == index.indexId;
        });
      });
      await deleteCollectionIndexes(toDeleted);

      indexes.value = currIndexes;
      if (toCreated.length != 0 || toDeleted.length != 0) {
        indexes.value = await $tauriCommands.getCollectionIndexesByCollectionIdWithAll(collectionId);
      }
    }

    return {
      indexes,
      activeIndexId,
      activeIndex,
      refresh: syncCollectionIndexesWithIndexProfiles,
    };
  }

  /**
   * Delete the given collection indexes.
   *
   * Deletion includes:
   * - remove the indexes from the remote vectorstore;
   * - remove the sessions and related data of the indexes from the cache;
   * - remove the indexes from the local database.
   */
  async function deleteCollectionIndexes(indexes: CollectionIndexWithAll[]) {
    for (const index of indexes) {
      // remove index from remote vectorstore
      await deleteIndexFromVectorstore(index.index.vectorDbClient, index.index.vectorDbConfig, index.id);
    }

    // remove sessions and related data of this index from the cache
    await sessionStore.deleteSessionsFromCacheByIndexes(indexes);

    // remove index from the local database
    await $tauriCommands.deleteCollectionIndexesById(indexes.map((index) => index.id));
  }

  /**
   * Get the index of a collection by id.
   */
  async function getCollectionIndexById(collectionId: number, indexProfileId: number) {
    return await $tauriCommands.getCollectionIndexByCollectionIdProfileIdWithAll(collectionId, indexProfileId);
  }

  /**
   * Get the active index of a collection by collection id.
   */
  async function getActiveIndexByCollectionId(collectionId: number) {
    const indexes = await $tauriCommands.getCollectionIndexesByCollectionIdWithAll(collectionId);
    const activeIndexId = getActiveIndexIdByCollectionId(collectionId);
    if (activeIndexId.value) {
      const activeIndex = indexes?.find((c) => c.id == activeIndexId.value);
      if (activeIndex) return activeIndex;
    }

    // fallback to first index
    const fallbackActiveIndex = indexes?.at(0);
    if (fallbackActiveIndex) {
      activeIndexId.value = fallbackActiveIndex.id;
    }

    return fallbackActiveIndex;
  }

  /**
   * Get the active index id of a collection by collection id.
   *
   * @param collectionId ID of the collection
   */
  function getActiveIndexIdByCollectionId(collectionId: number) {
    let activeIndexId = preferences.activeIndexIdByCollectionId.get(collectionId);
    if (!activeIndexId) {
      activeIndexId = ref<string | undefined>(undefined);
      preferences.activeIndexIdByCollectionId.set(collectionId, activeIndexId);
    }
    return activeIndexId;
  }

  /**
   * Set active collection by index in the array of collections.
   *
   * If no collection left, set the active collection to null.
   * If already active, return is undefined.
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
      }
    }
  }

  return {
    collections,
    collectionNames,
    activeCollectionId: preferences.activeCollectionId,
    load,
    storeCacheToTauriStore,
    getCollection,
    createCollection,
    reloadCollectionById,
    deleteCollectionById,
    useCollectionIndexes,
    getCollectionIndexById,
    getActiveIndexByCollectionId,
    getActiveIndexIdByCollectionId,
  };
});

function toPersistent(preference: CollectionPreference) {
  return {
    activeCollectionId: preference.activeCollectionId.value,
    activeIndexIdByCollectionId: [...preference.activeIndexIdByCollectionId.entries()].map(
      ([collectionId, indexId]) => [collectionId, indexId.value],
    ),
  } as PersistentCollectionPreference;
}

function fromPersistent(preference: CollectionPreference, stored: PersistentCollectionPreference) {
  preference.activeCollectionId.value = stored.activeCollectionId;
  for (const [key, value] of stored.activeIndexIdByCollectionId) {
    let activeIndex = preference.activeIndexIdByCollectionId.get(key);
    if (!activeIndex) {
      activeIndex = ref<string | undefined>(value);
      preference.activeIndexIdByCollectionId.set(key, activeIndex);
    } else {
      activeIndex.value = value;
    }
  }
}
