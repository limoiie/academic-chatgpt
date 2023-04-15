import { Embeddings } from 'langchain/embeddings';
import { PineconeStore, VectorStore } from 'langchain/vectorstores';
import { VectorDbClientExData, VectorDbConfigExData } from '~/utils/bindings';
import { CrossPineconeClient } from '~/utils/pinecone';

export async function createVectorstore(
  vectorstoreClient: VectorDbClientExData,
  vectorstoreConfig: VectorDbConfigExData,
  embeddings: Embeddings,
  namespace: string,
): Promise<VectorStore> {
  switch (vectorstoreConfig.clientType) {
    case 'pinecone':
      const clientInfo: PineconeVectorstoreConfigMeta = vectorstoreClient.info;
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
            metric: vectorstoreConfig.meta.metric,
            dimension: vectorstoreConfig.meta.dimension,
          }
        })
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
