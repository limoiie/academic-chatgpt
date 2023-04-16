import { OpenAIEmbeddings } from 'langchain/embeddings';
import { EmbeddingsClient, EmbeddingsConfig } from '~/utils/bindings';

export async function createEmbeddings(client: EmbeddingsClient, config: EmbeddingsConfig) {
  const clientInfo = JSON.parse(client.info);
  switch (config.clientType) {
    case 'openai':
      return new OpenAIEmbeddings({
        openAIApiKey: clientInfo.apiKey,
      });

    default:
      throw Error(`Not supported embeddings client: ${config.clientType}`);
  }
}
