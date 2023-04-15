import { defineStore } from 'pinia';
import { Ref } from 'vue';
import {
  CollectionOnIndexProfileWithAll,
  CollectionWithIndexes,
  deleteCollectionById as removeCollectionById,
} from '~/utils/bindings';

export const useCollectionStore = defineStore('collections', () => {
  const loaded = ref(false);

  const collections: Ref<CollectionWithIndexes[]> = ref([]);
  const collectionNames = computed(() => collections.value.map((c) => c.name));
  const indexProfilesByCollectionId: Ref<Map<number, CollectionOnIndexProfileWithAll[]>> = ref(new Map());
  const activeIndexProfileIdByCollectionId: Ref<Map<number, string>> = ref(new Map());

  async function load() {
    if (!loaded.value) {
      await loadCollectionsFromDatabase();
      await loadIndexProfilesFromDatabase();
      loaded.value = true;
    }
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
    await removeCollectionById(id);
    collections.value = collections.value.filter((c) => c.id != id);
    indexProfilesByCollectionId.value.delete(id);
  }

  function getCollectionOnIndexProfileById(collectionId: number, indexProfileId: number) {
    return getCollectionOnIndexProfilesByCollectionId(collectionId)?.find((c) => c.indexId == indexProfileId);
  }

  function getCollectionOnIndexProfilesByCollectionId(id: number) {
    return indexProfilesByCollectionId.value.get(id);
  }

  return {
    collections,
    collectionNames,
    indexProfilesByCollectionId,
    load,
    reloadCollectionById,
    deleteCollectionById,
    loadIndexProfilesFromDatabase,
    getCollectionOnIndexProfileById,
  };
});
