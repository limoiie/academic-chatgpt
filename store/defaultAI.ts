import { defineStore } from 'pinia';

export type AIClientType = 'openai';

export type OpenAIGpt3Model =
  | 'gpt-3.5-turbo'
  | 'gpt-3.5-turbo-0301'
  | 'text-davinci-003'
  | 'text-davinci-002'
  | 'code-davinci-002';
export type OpenAIGpt4Model = 'gpt-4' | 'gpt-4-0314' | 'gpt-4-32k' | 'gpt-4-32k-0314';
export type OpenAIModel = OpenAIGpt3Model | OpenAIGpt4Model;

export type AIModelType = OpenAIModel;

export const allAIClients = ['openai'];

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

interface DefaultAIStore {
  defaultClient: AIClientType;
  defaultModel: AIModelType;
  defaultApiKey: string;
}

export const useDefaultAIStore = defineStore('defaultAI', () => {
  const { $tauriStore } = useNuxtApp();

  const defaultClient = ref<AIClientType | undefined>('openai');
  const defaultModel = ref<AIModelType | undefined>('gpt-3.5-turbo');
  const defaultApiKey = ref<string | undefined>(undefined);

  async function loadFromLocalStore() {
    const stored = await $tauriStore.get<DefaultAIStore>('defaultAIStore');
    if (stored) {
      defaultClient.value = stored.defaultClient;
      defaultModel.value = stored.defaultModel;
      defaultApiKey.value = stored.defaultApiKey;
      return defaultClient.value && defaultModel.value && defaultApiKey.value;
    }
    return false;
  }

  async function storeToLocalStore() {
    await $tauriStore.set('defaultAIStore', {
      defaultClient: defaultClient.value,
      defaultModel: defaultModel.value,
      defaultApiKey: defaultApiKey.value,
    } as DefaultAIStore);
    return true;
  }

  return {
    defaultAIClient: defaultClient,
    defaultAIApiKey: defaultApiKey,
    defaultAIModel: defaultModel,
    loadFromLocalStore,
    storeToLocalStore,
  };
});
