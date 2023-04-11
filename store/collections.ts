import { defineStore } from 'pinia';
import { Ref } from 'vue';
import {
  CollectionWithProfiles,
  deleteCollectionById as removeCollectionById,
  IndexProfileWithAll,
} from '~/utils/bindings';

export const useCollectionStore = defineStore('collections', () => {
  const collections: Ref<CollectionWithProfiles[]> = ref([]);
  const indexProfilesByCollectionId: Ref<Map<number, IndexProfileWithAll[]>> = ref(new Map());

  async function loadFromDb() {
    collections.value = (await getCollectionsWithIndexProfiles()) || [];
  }

  async function loadIndexProfilesFromDb() {
    const map = new Map();
    for (const collection of collections.value) {
      const indexProfiles = await getIndexProfilesByCollectionIdWithAll(collection.id);
      map.set(collection.id, indexProfiles);
    }
    indexProfilesByCollectionId.value = map;
  }

  async function reloadCollectionById(id: number) {
    const all = await getCollectionsWithIndexProfiles();
    const i = all.findIndex((c) => c.id == id);
    const k = collections.value.findIndex((c) => c.id == id);
    collections.value[k] = all[i];

    const indexProfiles = await getIndexProfilesByCollectionIdWithAll(id);
    indexProfilesByCollectionId.value.set(id, indexProfiles);
  }

  async function deleteCollectionById(id: number) {
    await removeCollectionById(id);
    collections.value = collections.value.filter((c) => c.id != id);
    indexProfilesByCollectionId.value.delete(id);
  }

  return {
    collections,
    indexProfilesByCollectionId,
    loadFromDb,
    reloadCollectionById,
    deleteCollectionById,
    loadIndexProfilesFromDb,
  };
});
