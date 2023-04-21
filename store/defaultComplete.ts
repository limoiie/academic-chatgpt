import { defineStore } from 'pinia';
import { CompletionClientType, CompletionModelType } from '~/types';

interface DefaultCompleteStore {
  defaultConfig: CompletionConfig;
}

const STORE_KEY = 'defaultCompletionStore';

/**
 * Default completion agent store.
 *
 * This store is used to store the default client info and configuration of a
 * completion agent. The complete agent will be used for completing the user's
 * question or other completion-like queries.
 */
export const useDefaultCompleteStore = defineStore('defaultComplete', () => {
  const { $tauriStore } = useNuxtApp();

  /// Set openai as the default completion agent.
  const defaultConfig = ref<CompletionConfig>({
    client: 'openai' as CompletionClientType,
    meta: {
      model: 'gpt-3.5-turbo' as CompletionModelType,
      apiKey: undefined,
    },
  });

  async function load() {
    const stored = await $tauriStore.get<DefaultCompleteStore>(STORE_KEY);
    if (stored == null) return false;

    defaultConfig.value = stored.defaultConfig;
    return defaultConfig.value.client && defaultConfig.value.meta.apiKey && defaultConfig.value.meta.model;
  }

  async function store() {
    validateStore();
    await $tauriStore.set(STORE_KEY, {
      defaultConfig: defaultConfig.value,
    } as DefaultCompleteStore);
    await $tauriStore.save();
    return true;
  }

  function validateStore() {
    if (defaultConfig.value.meta.apiKey == null || defaultConfig.value.meta.apiKey.length == 0) {
      throw new Error('Invalid apiKey for the complete client.');
    }
  }

  return {
    defaultCompleteConfig: defaultConfig,
    load,
    store,
    validateStore,
  };
});
