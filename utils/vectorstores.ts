import { Embeddings } from 'langchain/embeddings';
import { PineconeStore, VectorStore } from 'langchain/vectorstores';
import { GetVectorDbConfigData } from '~/utils/bindings';
import { CrossPineconeClient } from '~/utils/pinecone';

export async function createVectorstore(
  vectorstoreConfig: GetVectorDbConfigData,
  embeddings: Embeddings,
  namespace: string,
): Promise<VectorStore> {
  switch (vectorstoreConfig.client) {
    case 'pinecone':
      const meta: PineconeVectorstoreConfigMeta = vectorstoreConfig.meta;
      const client = new CrossPineconeClient();
      await client.init({
        environment: meta.environment,
        apiKey: meta.apiKey,
      });
      // todo: create index if not exists
      const index = client.Index(meta.indexName);
      return await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex: index,
        namespace: namespace,
        textKey: 'text',
      });

    default:
      throw Error(`Not supported client: ${vectorstoreConfig.client}`);
  }
}
