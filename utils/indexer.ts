import { Embeddings } from 'langchain/embeddings';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PineconeStore, VectorStore } from 'langchain/vectorstores';
import { Document, DocumentChunk, getEmbeddingVectorByMd5hash, Splitting } from '~/utils/bindings';
import { dbDocumentChunk2Ui, uiDocumentChunks2Db } from '~/utils/db';
import { asyncFilter } from '~/utils/itertools';

export class Indexer {
  constructor(
    public embeddings: Embeddings,
    public vectorstore: VectorStore,
    public embeddingsConfigId: number,
    public splitting: Splitting,
    public onProgress = (..._: any []) => {},
  ) {}

  /**
   * Index documents.
   * Each document will be split into chunks first, each of which will be embedded with an Embeddings. After embedding,
   * all the embedding vectors will be uploaded into the given vectorstore for indexing.
   *
   * @param documents An array of documents.
   */
  async *indexDocuments(...documents: Document[]) {
    for (const document of documents) {
      await this.indexOneDocument(document);
      yield document;
    }
  }

  /**
   * Index one document.
   * The document will be split into chunks first, each of which will be embedded with an Embeddings. After embedding,
   * all the embedding vectors will be uploaded into the given vectorstore for indexing.
   *
   * @param document An array of documents.
   */
  async indexOneDocument(document: Document) {
    this.onProgress(`Fetching chunks of ${document.filename} from database...`);
    const existingChunks = await this.fetchChunksFromDb(document);
    this.onProgress('Found existing chunks:', existingChunks.length);
    if (existingChunks.length == 0) {
      this.onProgress(`Splitting ${document.filename} into chunks...`);
      existingChunks.push(...(await this.splitChunksIntoDb(document)));
      this.onProgress('Got split chunks:', existingChunks.length);
    }

    const chunksBeingIndexed = await this.filterAndUploadEmbeddedChunks(existingChunks);
    const vectors = await this.embeddingChunksAndStoreIntoDb(chunksBeingIndexed);
    await this.uploadEmbeddingVectors(vectors, chunksBeingIndexed);
  }

  /**
   * Fetch existing chunks if there were.
   */
  private async fetchChunksFromDb(document: Document) {
    return await getDocumentChunks({
      documentId: document.id,
      splitting: { Id: this.splitting.id },
    });
  }

  /**
   * Filter out chunks that had already been embedded.
   * Upload the embedding vectors to vectorstore if there were.
   *
   * @param chunks The chunks going to be indexed.
   */
  private async filterAndUploadEmbeddedChunks(chunks: DocumentChunk[]) {
    this.onProgress('Filtering and uploading embedding vectors if there were...');

    const vectors: number[][] = [];
    const chunksBeingUploaded: DocumentChunk[] = [];
    const chunksBeingIndexed = await asyncFilter(chunks, async (chunk) => {
      const embeddingsResult = await getEmbeddingVectorByMd5hash({
        embeddings_config_id: this.embeddingsConfigId,
        md5_hash: chunk.md5Hash,
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

  private async embeddingChunksAndStoreIntoDb(chunks: DocumentChunk[]) {
    this.onProgress(`Embedding ${chunks.length} chunks...`)
    const vectors = await this.embeddings.embedDocuments(chunks.map((c) => c.content));

    this.onProgress(`Storing embedding vectors into database...`)
    await upsertEmbeddingVectorByMd5hashInBatch(
      chunks
        .map((chunk, i) => {
          return { chunk: chunk, vector: vectors[i] };
        })
        .map(({ chunk, vector }) => {
          return {
            vector: vector,
            identity: {
              md5_hash: chunk.md5Hash,
              embeddings_config_id: this.embeddingsConfigId,
            },
          };
        }),
    );
    return vectors;
  }

  private async uploadEmbeddingVectors(vectors: number[][], chunks: DocumentChunk[]) {
    this.onProgress('Storing vectors into vectorstore...');
    if (this.vectorstore instanceof PineconeStore) {
      await this.vectorstore.addVectors(
        vectors,
        chunks.map(dbDocumentChunk2Ui),
        chunks.map((e) => e.md5Hash),
      );
    } else {
      await this.vectorstore.addVectors(vectors, chunks.map(dbDocumentChunk2Ui));
    }
    this.onProgress('store done');
  }

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
      document_id: document.id,
      splitting: { Id: this.splitting.id },
    });
  }
}
