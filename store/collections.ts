import { defineStore } from 'pinia';
import { Ref } from 'vue';
import {
  CollectionOnIndexProfileWithAll,
  CollectionWithIndexes,
  createCollection as createDbCollection,
  deleteCollectionById as deleteDbCollectionById,
  IndexProfileWithAll,
} from '~/utils/bindings';

interface CollectionsStore {
  activeIndexProfileIdByCollectionId: Map<number, string>;
}

const STORE_KEY = 'collectionsStore';

export const useCollectionStore = defineStore('collections', () => {
  const { $tauriStore } = useNuxtApp();
  const loaded = ref(false);
  const cache = ref<CollectionsStore>({
    activeIndexProfileIdByCollectionId: new Map(),
  });

  const collections: Ref<CollectionWithIndexes[]> = ref([]);
  const collectionNames = computed(() => collections.value.map((c) => c.name));
  const indexProfilesByCollectionId: Ref<Map<number, CollectionOnIndexProfileWithAll[]>> = ref(new Map());

  async function load() {
    if (!loaded.value) {
      await loadCollectionsFromDatabase();
      await loadIndexProfilesFromDatabase();
      await loadCacheFromTauriStore();
      loaded.value = true;
    }
  }

  async function loadCacheFromTauriStore() {
    const stored = await $tauriStore.get<CollectionsStore>(STORE_KEY);
    if (stored == null) return false;
    cache.value = {
      activeIndexProfileIdByCollectionId: new Map(stored.activeIndexProfileIdByCollectionId),
    };
    return true;
  }

  async function storeCacheToTauriStore() {
    await $tauriStore.set(STORE_KEY, {
      ...cache.value,
      activeIndexProfileIdByCollectionId: [...cache.value.activeIndexProfileIdByCollectionId.entries()],
    });
    await $tauriStore.save();
    return true;
  }

  async function loadCollectionsFromDatabase() {
    collections.value = (await getCollectionsWithIndexProfiles()) || [];
  }

  async function loadIndexProfilesFromDatabase() {
    const map = new Map();
    for (const collection of collections.value) {
      const indexProfiles = await getCollectionsOnIndexesByCollectionIdWithAll(collection.id);
      map.set(collection.id, indexProfiles);
    }
    indexProfilesByCollectionId.value = map;
  }

  async function createCollection(defaultIndexProfile: IndexProfileWithAll) {
    const newCollectionName = uniqueName('Collection', collectionNames.value);
    const collection = await createDbCollection({ documents: [], name: newCollectionName });
    const collectionIndex = await createCollectionOnIndex({
      name: defaultIndexProfile.name,
      collectionId: collection.id,
      indexId: defaultIndexProfile.id,
      indexedDocuments: '',
    });

    console.log('cache.value.activeIndexProfileIdByCollectionId', cache.value.activeIndexProfileIdByCollectionId);
    cache.value.activeIndexProfileIdByCollectionId.set(collection.id, collectionIndex.id);
    await storeCacheToTauriStore();

    await reloadCollectionById(collection.id);
    return collection;
  }

  async function reloadCollectionById(id: number) {
    const all = await getCollectionsWithIndexProfiles();
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

    const indexProfiles = await getCollectionsOnIndexesByCollectionIdWithAll(id);
    indexProfilesByCollectionId.value.set(id, indexProfiles);
  }

  async function deleteCollectionById(id: number) {
    await deleteDbCollectionById(id);
    collections.value = collections.value.filter((c) => c.id != id);
    indexProfilesByCollectionId.value.delete(id);

    cache.value.activeIndexProfileIdByCollectionId.delete(id);
    await storeCacheToTauriStore();
  }

  function getCollectionOnIndexProfileById(collectionId: number, indexProfileId: number) {
    return getCollectionOnIndexProfilesByCollectionId(collectionId)?.find((c) => c.indexId == indexProfileId);
  }

  function getCollectionOnIndexProfilesByCollectionId(id: number) {
    return indexProfilesByCollectionId.value.get(id);
  }

  async function getDefaultIndexProfileIdByCollectionId(id: number) {
    const defaultIndexId = cache.value.activeIndexProfileIdByCollectionId.get(id);
    if (defaultIndexId) return defaultIndexId;

    // fallback to first index profile
    const fallbackIndexId = getCollectionOnIndexProfilesByCollectionId(id)?.[0].id;
    if (fallbackIndexId) {
      cache.value.activeIndexProfileIdByCollectionId.set(id, fallbackIndexId);
      await storeCacheToTauriStore();
    }
    return fallbackIndexId;
  }

  return {
    collections,
    collectionNames,
    indexProfilesByCollectionId,
    load,
    createCollection,
    reloadCollectionById,
    deleteCollectionById,
    loadIndexProfilesFromDatabase,
    getCollectionOnIndexProfileById,
    getDefaultIndexProfileIdByCollectionId,
  };
});
