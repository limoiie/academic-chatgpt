import { defineStore } from 'pinia';
import { Ref } from 'vue';
import {
  CollectionIndexWithAll,
  CollectionWithIndexes,
  createCollection as createDbCollection,
  deleteCollectionById as deleteDbCollectionById,
  IndexProfileWithAll,
} from '~/utils/bindings';

interface CollectionsStore {
  activeCollectionId: number | undefined;
  activeIndexIdByCollectionId: Map<number, string>;
}

const STORE_KEY = 'collectionsStore';

export const useCollectionStore = defineStore('collections', () => {
  const { $tauriStore } = useNuxtApp();
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
    collections.value = (await getCollectionsWithIndexes()) || [];
  }

  async function loadIndexesFromDatabase() {
    const map = new Map();
    for (const collection of collections.value) {
      const indexes = await getCollectionIndexesByCollectionIdWithAll(collection.id);
      map.set(collection.id, indexes);
    }
    indexesByCollectionId.value = map;
  }

  async function createCollection(defaultIndexProfile: IndexProfileWithAll) {
    const newCollectionName = uniqueName('Collection', collectionNames.value);
    const collection = await createDbCollection({ documents: [], name: newCollectionName });
    const collectionIndex = await createCollectionIndex({
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
    const all = await getCollectionsWithIndexes();
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

    const indexes = await getCollectionIndexesByCollectionIdWithAll(id);
    indexesByCollectionId.value.set(id, indexes);
  }

  async function deleteCollectionById(id: number) {
    const i = collections.value.findIndex((c) => c.id == id);
    if (i == -1) return { deleted: undefined, fallback: undefined };

    await deleteDbCollectionById(id);
    const deleted = collections.value[i];
    collections.value = [...collections.value.slice(0, i), ...collections.value.slice(i + 1)];
    indexesByCollectionId.value.delete(id);

    cache.value.activeIndexIdByCollectionId.delete(id);
    await storeCacheToTauriStore();

    if (cache.value.activeCollectionId != id) {
      return { deleted, fallback: undefined };
    }

    const fallbackIdx = Math.min(i, collections.value.length - 1);
    const fallback = collections.value[fallbackIdx];
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
      throw Error('No index profile found for collection')
    }
    cache.value.activeIndexIdByCollectionId.set(id, fallbackActiveIndexId);
    await storeCacheToTauriStore();
    return fallbackActiveIndexId;
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
