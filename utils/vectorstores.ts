import { Embeddings } from 'langchain/embeddings';
import { PineconeStore } from 'langchain/vectorstores';
import { GetVectorDbConfigData } from '~/utils/bindings';

export async function createVectorstore(
  vectorstoreConfig: GetVectorDbConfigData,
  embeddings: Embeddings,
  namespace: string,
) {
  console.log(vectorstoreConfig.name, 'namespace', namespace);
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
      return new PineconeStore(embeddings, {
        pineconeIndex: index,
        namespace: namespace,
        textKey: 'text',
      });

    default:
      throw Error(`Not supported client: ${vectorstoreConfig.client}`);
  }
}
