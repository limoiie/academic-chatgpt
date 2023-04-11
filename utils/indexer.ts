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
      console.log('one document indexing');
      await this.indexOneDocument(document);
      console.log('one document index done');
      yield document;
    }
    console.log('index done');
  }

  /**
   * Index one document.
   * The document will be split into chunks first, each of which will be embedded with an Embeddings. After embedding,
   * all the embedding vectors will be uploaded into the given vectorstore for indexing.
   *
   * @param document An array of documents.
   */
  async indexOneDocument(document: Document) {
    const existingChunks = await this.fetchChunksFromDb(document);
    console.log('Found existing chunks:', existingChunks.length);
    if (existingChunks.length == 0) {
      existingChunks.push(...(await this.splitChunksIntoDb(document)));
      console.log('Split chunks:', existingChunks.length);
    }

    const chunksBeingIndexed = await this.filterAndUploadEmbeddedChunks(existingChunks);
    console.log('Going to be indexed chunks:', chunksBeingIndexed.length);
    const vectors = await this.embeddingChunksAndStoreIntoDb(chunksBeingIndexed);
    console.log('Embedded:', vectors.length);
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
    const vectors = await this.embeddings.embedDocuments(chunks.map((c) => c.content));
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
    if (this.vectorstore instanceof PineconeStore) {
      console.log('start store vectors into pinecone');
      await this.vectorstore.addVectors(
        vectors,
        chunks.map(dbDocumentChunk2Ui),
        chunks.map((e) => e.md5Hash),
      );
    } else {
      console.log('start store vectors into vectorstore');
      await this.vectorstore.addVectors(vectors, chunks.map(dbDocumentChunk2Ui));
    }
    console.log('store done');
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
