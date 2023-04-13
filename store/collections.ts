import { defineStore } from 'pinia';
import { Ref } from 'vue';
import {
  CollectionWithProfiles,
  deleteCollectionById as removeCollectionById,
  IndexProfileWithAll,
} from '~/utils/bindings';

export const useCollectionStore = defineStore('collections', () => {
  const loaded = ref(false);

  const collections: Ref<CollectionWithProfiles[]> = ref([]);
  const collectionNames = computed(() => collections.value.map((c) => c.name));
  const indexProfilesByCollectionId: Ref<Map<number, IndexProfileWithAll[]>> = ref(new Map());

  async function loadFromDb() {
    if (!loaded.value) {
      collections.value = (await getCollectionsWithIndexProfiles()) || [];
      loaded.value = true;
    }
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
    collectionNames,
    indexProfilesByCollectionId,
    loadFromDb,
    reloadCollectionById,
    deleteCollectionById,
    loadIndexProfilesFromDb,
  };
});
