import { message } from 'ant-design-vue';
import { Embeddings } from 'langchain/embeddings';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PineconeStore, VectorStore } from 'langchain/vectorstores';
import { CollectionIndexWithAll, Document, DocumentChunk, Splitting } from '~/plugins/tauri/bindings';
import { dbDocumentChunk2Ui, uiDocumentChunks2Db } from '~/utils/db';
import { IndexSyncStatus } from '~/utils/indexSyncStatus';
import { asyncFilter } from '~/utils/itertools';
import { Tracer } from '~/utils/tracer';

export class Indexer {
  tauriCommands: typeof import('~/plugins/tauri/bindings');

  constructor(
    public embeddings: Embeddings,
    public vectorstore: VectorStore,
    public embeddingsConfigId: number,
    public splitting: Splitting,
    public tracer: Tracer,
  ) {
    const { $tauriCommands } = useNuxtApp();
    this.tauriCommands = $tauriCommands;
  }

  static async create(collectionIndex: CollectionIndexWithAll, tracer: Tracer) {
    const namespace = collectionIndex.id;
    const embeddings = await createEmbeddings(
      collectionIndex.index.embeddingsClient,
      collectionIndex.index.embeddingsConfig,
    );
    const vectorstore = await createVectorstore(
      collectionIndex.index.vectorDbClient,
      collectionIndex.index.vectorDbConfig,
      embeddings,
      namespace,
    );
    return new Indexer(
      embeddings,
      vectorstore,
      collectionIndex.index.embeddingsConfigId,
      collectionIndex.index.splitting,
      tracer,
    );
  }

  /**
   * Sync the index with the given sync status.
   */
  async sync(status: IndexSyncStatus, index: CollectionIndexWithAll) {
    const deleted = await this.removeIndexedDocuments(status.toDeleted, index);
    const indexed = await this.indexDocuments(index, ...status.toIndexed);
    status.toIndexed = [];
    status.toDeleted = [];
    return {
      indexed,
      deleted,
    };
  }

  /**
   * Remove the given documents from the index.
   *
   * This function does not remove the documents from the database. It only
   * removes the indexed vectors from the vector database and the indexed
   * records from the local database. Additionally, the vectors cached in local
   * will be preserved.
   *
   * @param toDeleted
   * @param index
   */
  async removeIndexedDocuments(toDeleted: number[], index: CollectionIndexWithAll) {
    this.tracer.onStepStart('Deleting', `vectors of ${toDeleted.length} obstacle documents...`, undefined);

    if (toDeleted.length == 0) {
      this.tracer.log('No vectors to delete, skipping...');
      this.tracer.onStepEnd();
      return 0;
    }

    this.tracer.log('fetching vectors to delete...');
    const vectorIds = await this.tauriCommands
      .getChunkMd5hashesByDocumentsAndSplitting(toDeleted, {
        Id: index.index.splittingId,
      })
      .then((vectors) => vectors.map((vectors) => vectors.md5Hash));
    this.tracer.log(`fetched vectors to delete: ${vectorIds.length}`);

    this.tracer.log('deleting vectors from vector database...');
    if (this.vectorstore instanceof PineconeStore) {
      await this.vectorstore.pineconeIndex
        .delete1({
          ids: vectorIds,
          namespace: index.id,
          deleteAll: false,
        })
        .catch((e) => {
          message.warn(
            'Deleting vectors failed: ' + errToString(e) + '. If you are using Pinecone, you may ignore this.',
          );
        });
    } else {
      message.warn('Deleting vectors is not supported for this vector store.');
    }

    const deleted = await this.tauriCommands.removeDocumentsFromCollectionIndex(index.id, toDeleted);
    index.indexedDocuments.filter((document) => !toDeleted.includes(document.id));
    this.tracer.onStepEnd();
    return deleted;
  }

  /**
   * Index documents.
   * Each document will be split into chunks first, each of which will be embedded with an Embeddings. After embedding,
   * all the embedding vectors will be uploaded into the given vectorstore for indexing.
   *
   * @param index The collection index.
   * @param documents An array of documents.
   */
  async indexDocuments(index: CollectionIndexWithAll, ...documents: Document[]) {
    this.tracer.onStepStart('Indexing', `${documents.length} new documents...`, documents.length);
    for (const document of documents) {
      await this.indexOneDocument(index, document);
    }
    this.tracer.onStepEnd();
    return documents.length;
  }

  /**
   * Index one document.
   * The document will be split into chunks first, each of which will be embedded with an Embeddings. After embedding,
   * all the embedding vectors will be uploaded into the given vectorstore for indexing.
   *
   * @param index The collection index.
   * @param document An array of documents.
   */
  async indexOneDocument(index: CollectionIndexWithAll, document: Document) {
    this.tracer.onStepStart(document.filename, '', undefined);

    this.tracer.log(`Fetching chunks of ${document.filename} from database...`);
    const existingChunks = await this.fetchChunksFromDb(document);
    this.tracer.log('Found existing chunks:', existingChunks.length);

    if (existingChunks.length == 0) {
      this.tracer.log(`Splitting ${document.filename} into chunks...`);
      existingChunks.push(...(await this.splitChunksIntoDb(document)));
      this.tracer.log('Got split chunks:', existingChunks.length);
    }

    const chunksBeingIndexed = await this.filterAndUploadEmbeddedChunks(existingChunks);
    const vectors = await this.embeddingChunksAndStoreIntoDb(chunksBeingIndexed);
    await this.uploadEmbeddingVectors(vectors, chunksBeingIndexed);

    const upserted = await this.tauriCommands.upsertDocumentsInCollectionIndex(index.id, [document.id]);
    index.indexedDocuments.push(...upserted);
    this.tracer.onStepEnd();
  }

  /**
   * Fetch existing chunks if there were.
   */
  private async fetchChunksFromDb(document: Document) {
    return await this.tauriCommands.getDocumentChunks(document.id, { Id: this.splitting.id });
  }

  /**
   * Filter out chunks that had already been embedded.
   * Upload the embedding vectors to vectorstore if there were.
   *
   * @param chunks The chunks going to be indexed.
   */
  private async filterAndUploadEmbeddedChunks(chunks: DocumentChunk[]) {
    this.tracer.log('Filtering and uploading embedding vectors if there were...');

    const vectors: number[][] = [];
    const chunksBeingUploaded: DocumentChunk[] = [];
    const chunksBeingIndexed = await asyncFilter(chunks, async (chunk) => {
      const embeddingsResult = await this.tauriCommands.getEmbeddingVectorByMd5hash({
        embeddingsConfigId: this.embeddingsConfigId,
        md5Hash: chunk.md5Hash,
      });
      if (embeddingsResult != null) {
        vectors.push(embeddingsResult.vector);
        chunksBeingUploaded.push(chunk);
        return false;
      }
      return true;
    });
    await this.uploadEmbeddingVectors(vectors, chunksBeingUploaded);
    return chunksBeingIndexed;
  }

  /**
   * Embedding chunks and store into local database.
   */
  private async embeddingChunksAndStoreIntoDb(chunks: DocumentChunk[]) {
    this.tracer.log(`Embedding ${chunks.length} chunks...`);
    const vectors = await this.embeddings.embedDocuments(chunks.map((c) => c.content));

    this.tracer.log(`Storing embedding vectors into database...`);
    await this.tauriCommands.upsertEmbeddingVectorByMd5hashInBatch(
      chunks
        .map((chunk, i) => {
          return { chunk: chunk, vector: vectors[i] };
        })
        .map(({ chunk, vector }) => {
          return {
            vector: vector,
            identity: {
              md5Hash: chunk.md5Hash,
              embeddingsConfigId: this.embeddingsConfigId,
            },
          };
        }),
    );
    return vectors;
  }

  /**
   * Upload embedding vectors to vectorstore.
   */
  private async uploadEmbeddingVectors(vectors: number[][], chunks: DocumentChunk[]) {
    this.tracer.log('Storing vectors into vectorstore...');
    if (this.vectorstore instanceof PineconeStore) {
      await this.vectorstore.addVectors(
        vectors,
        chunks.map(dbDocumentChunk2Ui),
        chunks.map((e) => e.md5Hash),
      );
    } else {
      await this.vectorstore.addVectors(vectors, chunks.map(dbDocumentChunk2Ui));
    }
    this.tracer.log('store done');
  }

  /**
   * Split document into chunks, and store them into database.
   */
  private async splitChunksIntoDb(document: Document) {
    // todo: choose different loader according to the document type
    const loader = new PDFBytesLoader(document.filepath);
    const rawChunks = await loader.loadAndSplit(
      new RecursiveCharacterTextSplitter({
        chunkOverlap: this.splitting.chunkOverlap,
        chunkSize: this.splitting.chunkSize,
      }),
    );
    // store into db
    return await this.tauriCommands.createChunksByDocument({
      chunks: rawChunks.map(uiDocumentChunks2Db),
      documentId: document.id,
      splitting: { Id: this.splitting.id },
    });
  }
}
