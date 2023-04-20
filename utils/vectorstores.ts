import { Embeddings } from 'langchain/embeddings';
import { PineconeStore, VectorStore } from 'langchain/vectorstores';
import { VectorDbClient, VectorDbConfig } from '~/plugins/tauri/bindings';
import { CrossPineconeClient } from '~/utils/pinecone';

export async function createVectorstore(
  vectorstoreClient: VectorDbClient,
  vectorstoreConfig: VectorDbConfig,
  embeddings: Embeddings,
  namespace: string,
): Promise<VectorStore> {
  switch (vectorstoreConfig.clientType) {
    case 'pinecone':
      const clientInfo = JSON.parse(vectorstoreClient.info) as PineconeVectorstoreClientInfo;
      const configMeta = JSON.parse(vectorstoreConfig.meta) as PineconeVectorstoreConfigMeta;

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

/**
 * Delete the vectors for indexing from vectorstore
 *
 * @param vectorstoreClient
 * @param vectorstoreConfig
 * @param namespace
 */
export async function deleteIndexFromVectorstore(
  vectorstoreClient: VectorDbClient,
  vectorstoreConfig: VectorDbConfig,
  namespace: string,
) {
  const clientInfo = JSON.parse(vectorstoreClient.info);

  switch (vectorstoreConfig.clientType) {
    case 'pinecone':
      const client = new CrossPineconeClient();
      await client.init({
        environment: clientInfo.environment,
        apiKey: clientInfo.apiKey,
      });

      const index = client.Index(namespace);
      await index.delete1({
        namespace: namespace,
        deleteAll: true,
      });
  }
}
