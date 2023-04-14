import { OpenAIEmbeddings } from 'langchain/embeddings';
import { EmbeddingsClientExData, GetEmbeddingsConfigData } from '~/utils/bindings';

export async function createEmbeddings(client: EmbeddingsClientExData, config: GetEmbeddingsConfigData) {
  switch (config.clientType) {
    case 'openai':
      return new OpenAIEmbeddings({
        openAIApiKey: client.info.apiKey,
      });

    default:
      throw Error(`Not supported embeddings client: ${config.clientType}`);
  }
}
