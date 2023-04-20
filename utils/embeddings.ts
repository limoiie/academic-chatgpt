import { OpenAIEmbeddings } from 'langchain/embeddings';
import { EmbeddingsClient, EmbeddingsConfig } from '~/plugins/tauri/bindings';

export async function createEmbeddings(client: EmbeddingsClient, config: EmbeddingsConfig) {
  switch (config.clientType) {
    case 'openai':
      const clientInfo = JSON.parse(client.info) as OpenAIEmbeddingsClientInfo;
      const configMeta = JSON.parse(config.meta) as OpenAIEmbeddingsConfigMeta;
      if (configMeta.dimension && configMeta.dimension !== 1536) {
        throw Error(`Not supported dimension for OpenAI embedding: ${configMeta.dimension}`);
      }
      return new OpenAIEmbeddings({
        openAIApiKey: clientInfo.apiKey,
      });

    default:
      throw Error(`Not supported embeddings client: ${config.clientType}`);
  }
}
