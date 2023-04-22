import { message } from 'ant-design-vue';
import { defineStore } from 'pinia';
import { Ref } from 'vue';
import { Collection, CollectionIndexWithAll, IndexProfileWithAll } from '~/plugins/tauri/bindings';
import { deleteIndexFromVectorstore } from '~/utils/vectorstores';

interface CollectionsStore {
  activeCollectionId: Ref<number | undefined>;
  activeIndexIdByCollectionId: Map<number, Ref<string | undefined>>;
}

interface PersistentCollectionsStore {
  activeCollectionId: number | undefined;
  activeIndexIdByCollectionId: [number, string | undefined][];
}

const STORE_KEY = 'collectionsStore';

export const useCollectionsStore = defineStore('collections', () => {
  const { $tauriStore, $tauriCommands } = useNuxtApp();
  const loaded = ref(false);
  const cache: CollectionsStore = {
    activeCollectionId: ref<number | undefined>(undefined),
    activeIndexIdByCollectionId: new Map(),
  };

  const collections: Ref<Collection[]> = ref([]);
  const collectionNames = computed(() => collections.value.map((c) => c.name));
  const indexesByCollectionId: Ref<Map<number, CollectionIndexWithAll[]>> = ref(new Map());

  async function load() {
    if (!loaded.value) {
      await loadCollectionsFromDatabase();
      await loadIndexesFromDatabase();
      await loadCacheFromTauriStore();
      loaded.value = true;
    }
  }

  async function loadCacheFromTauriStore() {
    const stored = await $tauriStore.get<PersistentCollectionsStore>(STORE_KEY);
    if (stored == null) return false;
    fromPersistent(cache, stored);

    // Set fallback collection if active collection is not found.
    if (stored.activeCollectionId != null) {
      const active = collections.value.find((c) => c.id == stored.activeCollectionId);
      if (!active) {
        cache.activeCollectionId.value = undefined;
      }
    }
    return true;
  }

  async function storeCacheToTauriStore() {
    await $tauriStore.set(STORE_KEY, toPersistent(cache));
    await $tauriStore.save();
    return true;
  }

  async function loadCollectionsFromDatabase() {
    collections.value = (await $tauriCommands.getCollections()) || [];
  }

  async function loadIndexesFromDatabase() {
    const map = new Map();
    for (const collection of collections.value) {
      const indexes = await $tauriCommands.getCollectionIndexesByCollectionIdWithAll(collection.id);
      map.set(collection.id, indexes);
    }
    indexesByCollectionId.value = map;
  }

  async function getCollection(id: number) {
    return collections.value.find((c) => c.id == id);
  }

  async function createCollection(defaultIndexProfile: IndexProfileWithAll) {
    const newCollectionName = uniqueName('Collection', collectionNames.value);
    const collection = await $tauriCommands.createCollection({ documents: [], name: newCollectionName });
    const collectionIndex = await $tauriCommands.createCollectionIndex({
      name: defaultIndexProfile.name,
      collectionId: collection.id,
      indexId: defaultIndexProfile.id,
    });

    cache.activeIndexIdByCollectionId.set(collection.id, ref(collectionIndex.id));
    await storeCacheToTauriStore();

    await reloadCollectionById(collection.id);
    return collection;
  }

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
    indexesByCollectionId.value.set(id, indexes);
  }

  async function deleteCollectionById(id: number) {
    const i = collections.value.findIndex((c) => c.id == id);
    if (i == -1) return { deleted: undefined, fallback: undefined };

    // remove from remote vectorstore
    for (const index of indexesByCollectionId.value.get(id) || []) {
      await deleteIndexFromVectorstore(index.index.vectorDbClient, index.index.vectorDbConfig, index.id).catch((e) =>
        message.warn(
          `Failed to delete index from vectorstore: ${errToString(e)}.` +
            `If the vectorstore from pinecone, it is safe to ignore.`,
        ),
      );
    }

    // remove from local database
    await $tauriCommands.deleteCollectionById(id);
    const deleted = collections.value[i];
    collections.value = [...collections.value.slice(0, i), ...collections.value.slice(i + 1)];

    // delete index-related caches
    indexesByCollectionId.value.delete(id);
    const activeIndexId = cache.activeIndexIdByCollectionId.get(id);
    if (activeIndexId) {
      cache.activeIndexIdByCollectionId.delete(id);
      activeIndexId.value = undefined;
    }
    await storeCacheToTauriStore();

    // set fallback collection if deleted collection is active
    const fallback = cache.activeCollectionId.value != id ? undefined : await setActiveCollectionIdByNo(i);
    return { deleted, fallback };
  }

  function getCollectionIndexById(collectionId: number, indexProfileId: number) {
    return getCollectionIndexesByCollectionId(collectionId)?.find((c) => c.indexId == indexProfileId);
  }

  function getCollectionIndexesByCollectionId(id: number) {
    return indexesByCollectionId.value.get(id);
  }

  async function getActiveIndexByCollectionId(id: number) {
    const existingActiveIndexId = cache.activeIndexIdByCollectionId.get(id);
    const activeIndexId = existingActiveIndexId?.value;
    if (activeIndexId) {
      const activeIndex = getCollectionIndexesByCollectionId(id)?.find((c) => c.id == activeIndexId);
      if (activeIndex) return activeIndex;
    }

    // fallback to first index
    const fallbackActiveIndex = getCollectionIndexesByCollectionId(id)?.[0];
    if (!fallbackActiveIndex) {
      return fallbackActiveIndex;
    }
    if (existingActiveIndexId) {
      existingActiveIndexId.value = fallbackActiveIndex.id;
    } else {
      cache.activeIndexIdByCollectionId.set(id, ref(fallbackActiveIndex.id));
    }
    await storeCacheToTauriStore();
    return fallbackActiveIndex;
  }

  async function getActiveIndexIdByCollectionId(id: number) {
    return (await getActiveIndexByCollectionId(id))?.id;
  }

  /**
   * Set active collection by index in collections array.
   *
   * If no collection left, set active collection to null.
   * If already active, return undefined.
   * Otherwise, return the active collection.
   *
   * @param no the index of the collection in collections to be set as active
   */
  async function setActiveCollectionIdByNo(no: number) {
    no = Math.min(no, collections.value.length - 1);
    const activeCollection = collections.value.at(no);
    if (!activeCollection) {
      // there is no collection left
      return null;
    }
    if (activeCollection.id == cache.activeCollectionId.value) {
      // already active, skip
      return undefined;
    }

    cache.activeCollectionId.value = activeCollection.id;
    await storeCacheToTauriStore();
    return activeCollection;
  }

  async function setActiveCollectionId(id: number) {
    cache.activeCollectionId.value = id;
    await storeCacheToTauriStore();
  }

  return {
    collections,
    collectionNames,
    activeCollectionId: cache.activeCollectionId,
    indexesByCollectionId,
    load,
    getCollection,
    createCollection,
    reloadCollectionById,
    deleteCollectionById,
    loadIndexesFromDatabase,
    getCollectionIndexById,
    getActiveIndexByCollectionId,
    getActiveIndexIdByCollectionId,
    setActiveCollectionId,
  };
});

function toPersistent(cache: CollectionsStore) {
  return {
    activeCollectionId: cache.activeCollectionId.value,
    activeIndexIdByCollectionId: [...cache.activeIndexIdByCollectionId.entries()].map(([collectionId, indexId]) => [
      collectionId,
      indexId.value,
    ]),
  } as PersistentCollectionsStore;
}

function fromPersistent(cache: CollectionsStore, stored: PersistentCollectionsStore) {
  cache.activeCollectionId.value = stored.activeCollectionId;
  cache.activeIndexIdByCollectionId = new Map(stored.activeIndexIdByCollectionId.map(([k, v]) => [k, ref(v)]));
}
