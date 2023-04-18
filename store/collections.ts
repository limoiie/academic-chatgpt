import { message } from 'ant-design-vue';
import { defineStore } from 'pinia';
import { Ref } from 'vue';
import { CollectionIndexWithAll, CollectionWithIndexes, IndexProfileWithAll } from '~/plugins/tauri/bindings';
import { deleteIndexFromVectorstore } from '~/utils/vectorstores';

interface CollectionsStore {
  activeCollectionId: number | undefined;
  activeIndexIdByCollectionId: Map<number, string>;
}

const STORE_KEY = 'collectionsStore';

export const useCollectionsStore = defineStore('collections', () => {
  const { $tauriStore, $tauriCommands } = useNuxtApp();
  const loaded = ref(false);
  const cache = ref<CollectionsStore>({
    activeCollectionId: undefined,
    activeIndexIdByCollectionId: new Map(),
  });

  const collections: Ref<CollectionWithIndexes[]> = ref([]);
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
    const stored = await $tauriStore.get<CollectionsStore>(STORE_KEY);
    if (stored == null) return false;
    cache.value = {
      ...stored,
      activeIndexIdByCollectionId: new Map(stored.activeIndexIdByCollectionId),
    };
    // Check if the active collection is still valid. If not, reset the active collection.
    if (stored.activeCollectionId != null) {
      const active = collections.value.find((c) => c.id == stored.activeCollectionId);
      if (!active) {
        cache.value.activeCollectionId = undefined;
      }
    }
    return true;
  }

  async function storeCacheToTauriStore() {
    await $tauriStore.set(STORE_KEY, {
      ...cache.value,
      activeIndexIdByCollectionId: [...cache.value.activeIndexIdByCollectionId.entries()],
    });
    await $tauriStore.save();
    return true;
  }

  async function loadCollectionsFromDatabase() {
    collections.value = (await $tauriCommands.getCollectionsWithIndexes()) || [];
  }

  async function loadIndexesFromDatabase() {
    const map = new Map();
    for (const collection of collections.value) {
      const indexes = await $tauriCommands.getCollectionIndexesByCollectionIdWithAll(collection.id);
      map.set(collection.id, indexes);
    }
    indexesByCollectionId.value = map;
  }

  async function createCollection(defaultIndexProfile: IndexProfileWithAll) {
    const newCollectionName = uniqueName('Collection', collectionNames.value);
    const collection = await $tauriCommands.createCollection({ documents: [], name: newCollectionName });
    const collectionIndex = await $tauriCommands.createCollectionIndex({
      name: defaultIndexProfile.name,
      collectionId: collection.id,
      indexId: defaultIndexProfile.id,
    });

    cache.value.activeIndexIdByCollectionId.set(collection.id, collectionIndex.id);
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
    cache.value.activeIndexIdByCollectionId.delete(id);
    await storeCacheToTauriStore();

    // set fallback collection if deleted collection is active
    const fallback = cache.value.activeCollectionId != id ? undefined : await setActiveCollectionIdByNo(i);
    return { deleted, fallback };
  }

  function getCollectionIndexById(collectionId: number, indexProfileId: number) {
    return getCollectionIndexesByCollectionId(collectionId)?.find((c) => c.indexId == indexProfileId);
  }

  function getCollectionIndexesByCollectionId(id: number) {
    return indexesByCollectionId.value.get(id);
  }

  async function getActiveIndexByCollectionId(id: number) {
    const activeIndexId = cache.value.activeIndexIdByCollectionId.get(id);
    if (activeIndexId) {
      const activeIndex = getCollectionIndexesByCollectionId(id)?.find((c) => c.id == activeIndexId);
      if (activeIndex) return activeIndex;
    }

    // fallback to first index
    const fallbackActiveIndex = getCollectionIndexesByCollectionId(id)?.[0];
    if (fallbackActiveIndex) {
      cache.value.activeIndexIdByCollectionId.set(id, fallbackActiveIndex.id);
      await storeCacheToTauriStore();
    }
    return fallbackActiveIndex;
  }

  async function getActiveIndexIdByCollectionId(id: number) {
    const activeIndexId = cache.value.activeIndexIdByCollectionId.get(id);
    if (activeIndexId) return activeIndexId;

    // fallback to first index
    const fallbackActiveIndexId = getCollectionIndexesByCollectionId(id)?.[0].id;
    if (!fallbackActiveIndexId) {
      throw Error('No index profile found for collection');
    }
    cache.value.activeIndexIdByCollectionId.set(id, fallbackActiveIndexId);
    await storeCacheToTauriStore();
    return fallbackActiveIndexId;
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
    if (activeCollection.id == cache.value.activeCollectionId) {
      // already active, skip
      return undefined;
    }

    cache.value.activeCollectionId = activeCollection.id;
    await storeCacheToTauriStore();
    return activeCollection;
  }

  async function setActiveCollectionId(id: number) {
    cache.value.activeCollectionId = id;
    await storeCacheToTauriStore();
  }

  function getActiveCollectionId() {
    return cache.value.activeCollectionId;
  }

  return {
    collections,
    collectionNames,
    indexesByCollectionId,
    load,
    createCollection,
    reloadCollectionById,
    deleteCollectionById,
    loadIndexesFromDatabase,
    getCollectionIndexById,
    getActiveIndexByCollectionId,
    getActiveIndexIdByCollectionId,
    setActiveCollectionId,
    getActiveCollectionId,
  };
});
