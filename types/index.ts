declare global {
  interface CreateEmbeddingsClientFormState {
    name: string;
    type: string;
    info: any;
  }

  interface CreateEmbeddingsConfigFormState {
    clientType: string;
    name: string;
    meta: any;
  }

  interface CreateVectorDbConfigFormState {
    clientType: string;
    name: string;
    meta: any;
  }

  interface OpenAIEmbeddingsClientInfo {
    apiKey: string;
  }

  interface OpenAIEmbeddingsConfigMeta {
    dimension: number;
  }

  interface PineconeVectorstoreClientInfo {
    apiKey: string;
    indexName: string;
    environment: string;
  }

  interface PineconeVectorstoreConfigMeta {
    dimension: number;
    metric: string;
  }

  /**
   * The config of the completion.
   */
  interface CompletionConfig {
    client: CompletionClientType;
    meta: Record<string, any>;
  }
}

/**
 * The config of the completion client.
 */

export type CompletionClientType = 'openai';

export const allCompletionClients = ['openai'];

/**
 * The model type of the completion.
 */

export type CompletionOpenAIChatCompletionModelType =
  // GPT-4
  | 'gpt-4'
  | 'gpt-4-0314'
  | 'gpt-4-32k'
  | 'gpt-4-32k-0314'
  // GPT-3.5
  | 'gpt-3.5-turbo'
  | 'gpt-3.5-turbo-0301';

export type CompletionOpenAICompletionModelType =
  // GPT-3.5
  | 'text-davinci-003'
  | 'text-davinci-002'
  // GPT-3
  | 'text-curie-001'
  | 'text-babbage-001'
  | 'text-ada-001';

export type CompletionOpenAIModelType = CompletionOpenAIChatCompletionModelType | CompletionOpenAICompletionModelType;

export type CompletionModelType = CompletionOpenAIModelType;

export const allCompletionOpenAIModels: CompletionOpenAIModelType[] = [
  'gpt-4',
  'gpt-4-0314',
  'gpt-4-32k',
  'gpt-4-32k-0314',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-0301',
  'text-davinci-003',
  'text-davinci-002',
  'text-curie-001',
  'text-babbage-001',
  'text-ada-001',
];

export const allCompletionModels: { [client: string]: CompletionModelType[] } = {
  openai: allCompletionOpenAIModels,
};

/**
 * The mode of the completion chain.
 */

export type OpenAICompletionChainModeType = 'RephraseHistory' | 'WithoutHistory' | 'ChatCompletion' | 'Completion';

export type CompletionChainModeType = OpenAICompletionChainModeType;

export const allCompletionChainModes: {
  [client: string]: { value: CompletionChainModeType; label: string; tag?: string }[];
} = {
  openai: [
    { value: 'RephraseHistory', label: 'With History', tag: 'InnerDoc' },
    { value: 'WithoutHistory', label: 'History-less', tag: 'InnerDoc' },
    { value: 'ChatCompletion', label: 'With History', tag: 'Classic' },
    { value: 'Completion', label: 'History-less', tag: 'Classic' },
  ],
};
