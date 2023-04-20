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

interface OpenAIEmbeddingsConfigMeta {
  dimension: number;
}

interface PineconeVectorstoreConfigMeta {
  apiKey: string;
  indexName: string;
  environment: string;
  dimension: string;
  metric: string;
}
