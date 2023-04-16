import { message } from 'ant-design-vue';
import { Embeddings } from 'langchain/embeddings';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PineconeStore, VectorStore } from 'langchain/vectorstores';
import {
  CollectionOnIndexProfileWithAll,
  Document,
  DocumentChunk,
  getEmbeddingVectorByMd5hash,
  Splitting,
} from '~/utils/bindings';
import { dbDocumentChunk2Ui, uiDocumentChunks2Db } from '~/utils/db';
import { IndexSyncStatus } from '~/utils/indexSyncStatus';
import { asyncFilter } from '~/utils/itertools';
import { Tracer } from '~/utils/tracer';

export class Indexer {
  constructor(
    public embeddings: Embeddings,
    public vectorstore: VectorStore,
    public embeddingsConfigId: number,
    public splitting: Splitting,
    public tracer: Tracer,
  ) {}

  static async create(collectionOnIndex: CollectionOnIndexProfileWithAll, tracer: Tracer) {
    const namespace = collectionOnIndex.id;
    const embeddings = await createEmbeddings(
      collectionOnIndex.index.embeddingsClient,
      collectionOnIndex.index.embeddingsConfig,
    );
    const vectorstore = await createVectorstore(
      collectionOnIndex.index.vectorDbClient,
      collectionOnIndex.index.vectorDbConfig,
      embeddings,
      namespace,
    );
    return new Indexer(
      embeddings,
      vectorstore,
      collectionOnIndex.index.embeddingsConfigId,
      collectionOnIndex.index.splitting,
      tracer,
    );
  }

  /**
   * Sync the index with the given sync status.
   */
  async sync(status: IndexSyncStatus, indexProfile: CollectionOnIndexProfileWithAll) {
    const deleted = await this.deleteVectors(status.toDeleted, indexProfile);
    const indexed = await this.indexDocuments(...status.toIndexed);
    status.toIndexed = [];
    status.toDeleted = [];
    return {
      indexed,
      deleted,
    };
  }

  async deleteVectors(toDeleted: number[], indexProfile: CollectionOnIndexProfileWithAll) {
    this.tracer.onStepStart('Deleting', `vectors of ${toDeleted.length} obstacle documents...`, undefined);

    if (toDeleted.length == 0) {
      this.tracer.log('No vectors to delete, skipping...');
      this.tracer.onStepEnd();
      return 0;
    }

    this.tracer.log('fetching vectors to delete...');
    const vectorIds = await getChunkMd5hashesByDocumentsAndSplitting(toDeleted, {
      Id: indexProfile.index.splittingId,
    }).then((vectors) => vectors.map((vectors) => vectors.md5Hash));
    this.tracer.log(`fetched vectors to delete: ${vectorIds.length}`);

    this.tracer.log('deleting vectors from vector database...');
    if (this.vectorstore instanceof PineconeStore) {
      await this.vectorstore.pineconeIndex.delete1({
        ids: vectorIds,
        namespace: indexProfile.id,
      });
    } else {
      message.warn('Deleting vectors is not supported for this vector store.');
    }

    this.tracer.onStepEnd();
    return vectorIds.length;
  }

  /**
   * Index documents.
   * Each document will be split into chunks first, each of which will be embedded with an Embeddings. After embedding,
   * all the embedding vectors will be uploaded into the given vectorstore for indexing.
   *
   * @param documents An array of documents.
   */
  async indexDocuments(...documents: Document[]) {
    this.tracer.onStepStart('Indexing', `${documents.length} new documents...`, documents.length);
    for (const document of documents) {
      this.tracer.onStepStart(document.filename, '', undefined);
      await this.indexOneDocument(document);
      this.tracer.onStepEnd();
    }
    this.tracer.onStepEnd();
    return documents.length;
  }

  /**
   * Index one document.
   * The document will be split into chunks first, each of which will be embedded with an Embeddings. After embedding,
   * all the embedding vectors will be uploaded into the given vectorstore for indexing.
   *
   * @param document An array of documents.
   */
  async indexOneDocument(document: Document) {
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

    this.tracer.onStepEnd();
  }

  /**
   * Fetch existing chunks if there were.
   */
  private async fetchChunksFromDb(document: Document) {
    return await getDocumentChunks(document.id, { Id: this.splitting.id });
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
      const embeddingsResult = await getEmbeddingVectorByMd5hash({
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
    await upsertEmbeddingVectorByMd5hashInBatch(
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
    return await createChunksByDocument({
      chunks: rawChunks.map(uiDocumentChunks2Db),
      documentId: document.id,
      splitting: { Id: this.splitting.id },
    });
  }
}
