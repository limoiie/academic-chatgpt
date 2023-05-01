import { Document } from 'langchain/docstore';
import { CharacterTextSplitter, RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { extname } from 'pathe';
import { Splitting } from '~/plugins/tauri/bindings';
import { BaseDocumentLoader, DocumentLoader } from '~/utils/documentLoaders/base';
import { MarkdownTextLoader } from '~/utils/documentLoaders/markdown';
import { PDFBytesLoader } from '~/utils/documentLoaders/pdf';
import { TextLoader } from '~/utils/documentLoaders/text';

export class DocumentLoaderFactory {
  static async make(filepathOrBlob: string | Blob, ext?: string): Promise<BaseDocumentLoader> {
    if (typeof filepathOrBlob === 'string') {
      ext = ext || extname(filepathOrBlob);
    }

    switch (ext) {
      case '.pdf':
        return new PDFBytesLoader(filepathOrBlob);
      case '.md':
        return new MarkdownTextLoader(filepathOrBlob);
      case '.txt':
      default:
        return new TextLoader(filepathOrBlob);
    }
  }
}

export class BasicDocumentLoader extends DocumentLoader {
  async loadAndSplit(filepathOrBlob: string | Blob, splitting: Splitting, ext?: string): Promise<Document[]> {
    const loader = await DocumentLoaderFactory.make(filepathOrBlob, ext);
    switch (ext) {
      case '.pdf':
        return await loader.loadAndSplit(
          new RecursiveCharacterTextSplitter({
            chunkOverlap: splitting.chunkOverlap,
            chunkSize: splitting.chunkSize,
          }),
        );
      case '.md':
        return await loader.loadAndSplit(
          new CharacterTextSplitter({
            chunkOverlap: splitting.chunkOverlap,
            chunkSize: splitting.chunkSize,
          }),
        );
      case '.txt':
      default:
        return await loader.loadAndSplit(
          new CharacterTextSplitter({
            chunkOverlap: splitting.chunkOverlap,
            chunkSize: splitting.chunkSize,
          }),
        );
    }
  }
}
