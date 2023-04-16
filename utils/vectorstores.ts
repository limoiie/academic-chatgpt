import { Embeddings } from 'langchain/embeddings';
import { PineconeStore, VectorStore } from 'langchain/vectorstores';
import { VectorDbClient, VectorDbConfig } from '~/utils/bindings';
import { CrossPineconeClient } from '~/utils/pinecone';

export async function createVectorstore(
  vectorstoreClient: VectorDbClient,
  vectorstoreConfig: VectorDbConfig,
  embeddings: Embeddings,
  namespace: string,
): Promise<VectorStore> {
  const clientInfo = JSON.parse(vectorstoreClient.info);
  const configMeta = JSON.parse(vectorstoreConfig.meta);

  switch (vectorstoreConfig.clientType) {
    case 'pinecone':
      const client = new CrossPineconeClient();
      await client.init({
        environment: clientInfo.environment,
        apiKey: clientInfo.apiKey,
      });

      // Create index if not exists
      if ((await client.listIndexes()).indexOf(clientInfo.indexName) === -1) {
        await client.createIndex({
          createRequest: {
            name: clientInfo.indexName,
            metric: configMeta.metric,
            dimension: configMeta.dimension,
          },
        });
      }

      const index = client.Index(clientInfo.indexName);
      return await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex: index,
        namespace: namespace,
        textKey: 'text',
      });

    default:
      throw Error(`Not supported client: ${vectorstoreConfig.clientType}`);
  }
}
