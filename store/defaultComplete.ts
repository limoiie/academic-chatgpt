import { defineStore } from 'pinia';

export type CompleteClientType = 'openai';

export type OpenAIGpt3Model =
  | 'gpt-3.5-turbo'
  | 'gpt-3.5-turbo-0301'
  | 'text-davinci-003'
  | 'text-davinci-002'
  | 'code-davinci-002';
export type OpenAIGpt4Model = 'gpt-4' | 'gpt-4-0314' | 'gpt-4-32k' | 'gpt-4-32k-0314';
export type OpenAIModel = OpenAIGpt3Model | OpenAIGpt4Model;

export type CompleteModelType = OpenAIModel;

export const allCompleteClients = ['openai'];

export const allOpenAIModels = [
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-0301',
  'text-davinci-003',
  'text-davinci-002',
  'code-davinci-002',
  'gpt-4',
  'gpt-4-0314',
  'gpt-4-32k',
  'gpt-4-32k-0314',
];

interface DefaultCompleteStore {
  defaultConfig: CompleteConfig;
}

interface CompleteConfig {
  client: string;
  meta: Record<string, any>;
}

const STORE_KEY = 'defaultCompleteStore';

export const useDefaultCompleteStore = defineStore('defaultComplete', () => {
  const { $tauriStore } = useNuxtApp();

  const defaultConfig = ref<CompleteConfig>({
    client: 'openai' as CompleteClientType,
    meta: {
      model: 'gpt-3.5-turbo' as CompleteModelType,
      apiKey: undefined,
    },
  });

  async function loadFromLocalStore() {
    const stored = await $tauriStore.get<DefaultCompleteStore>(STORE_KEY);
    if (stored == null) return false;

    defaultConfig.value = stored.defaultConfig;
    return defaultConfig.value.client && defaultConfig.value.meta.apiKey && defaultConfig.value.meta.model;
  }

  async function storeToLocalStore() {
    validateStore();
    await $tauriStore.set(STORE_KEY, {
      defaultConfig: defaultConfig.value,
    } as DefaultCompleteStore);
    return true;
  }

  function validateStore() {
    if (defaultConfig.value.meta.apiKey == null || defaultConfig.value.meta.apiKey.length == 0) {
      throw new Error('Invalid apiKey for the complete client.');
    }
  }

  return {
    defaultCompleteConfig: defaultConfig,
    loadFromLocalStore,
    storeToLocalStore,
    validateStore,
  };
});
