import { OpenAIEmbeddings } from 'langchain/embeddings';
import { GetEmbeddingsClientData, GetEmbeddingsConfigData } from '~/utils/bindings';

export async function createEmbeddings(client: GetEmbeddingsClientData, config: GetEmbeddingsConfigData) {
  switch (config.client_type) {
    case 'openai':
      return new OpenAIEmbeddings({
        openAIApiKey: client.info.apiKey,
      });

    default:
      throw Error(`Not supported embeddings client: ${config.client_type}`);
  }
}
