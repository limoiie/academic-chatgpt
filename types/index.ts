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

export type CompletionOpenAIGpt3ModelType =
  | 'gpt-3.5-turbo'
  | 'gpt-3.5-turbo-0301'
  | 'text-davinci-003'
  | 'text-davinci-002'
  | 'code-davinci-002';

export type CompletionOpenAIGpt4ModelType = 'gpt-4' | 'gpt-4-0314' | 'gpt-4-32k' | 'gpt-4-32k-0314';

export type CompletionOpenAIModelType = CompletionOpenAIGpt3ModelType | CompletionOpenAIGpt4ModelType;

export type CompletionModelType = CompletionOpenAIModelType;

export const allCompletionOpenAIModels = [
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

/**
 * The mode of the completion chain.
 */

export type OpenAICompletionChainModeType = 'RephraseHistory' | 'WithoutHistory' | 'ChatCompletion' | 'Completion';

export type CompletionChainModeType = OpenAICompletionChainModeType;

export const allCompletionChainModes: { [client: string]: CompletionChainModeType[] } = {
  openai: ['RephraseHistory', 'WithoutHistory', 'ChatCompletion', 'Completion'] as OpenAICompletionChainModeType[],
};
