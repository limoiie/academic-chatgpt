import { CharacterTextSplitter, RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { extname } from 'pathe';
import { Splitting } from '~/plugins/tauri/bindings';
import { MarkdownTextLoader } from '~/utils/documentLoaders/markdown';
import { PDFBytesLoader } from '~/utils/documentLoaders/pdf';
import { TextLoader } from '~/utils/documentLoaders/text';

export async function loadAndSplitDocument(filepathOrBlob: string | Blob, splitting: Splitting, ext?: string) {
  if (typeof filepathOrBlob === 'string') {
    ext = ext || extname(filepathOrBlob);
  }

  switch (ext) {
    case '.pdf':
      const loader = new PDFBytesLoader(filepathOrBlob);
      return await loader.loadAndSplit(
        new RecursiveCharacterTextSplitter({
          chunkOverlap: splitting.chunkOverlap,
          chunkSize: splitting.chunkSize,
        }),
      );
    case '.md':
      const mdLoader = new MarkdownTextLoader(filepathOrBlob);
      return await mdLoader.loadAndSplit(
        new CharacterTextSplitter({
          chunkOverlap: splitting.chunkOverlap,
          chunkSize: splitting.chunkSize,
        }),
      );
    case '.txt':
    default:
      const textLoader = new TextLoader(filepathOrBlob);
      return await textLoader.loadAndSplit(
        new CharacterTextSplitter({
          chunkOverlap: splitting.chunkOverlap,
          chunkSize: splitting.chunkSize,
        }),
      );
  }
}

export async function summarizeDocument(filepathOrBlob: string | Blob, ext?: string) {
  if (typeof filepathOrBlob === 'string') {
    ext = ext || extname(filepathOrBlob);
  }

  // todo: implement summarization
}

export async function extractMetadata(filepathOrBlob: string | Blob, ext?: string) {
  if (typeof filepathOrBlob === 'string') {
    ext = ext || extname(filepathOrBlob);
  }

  switch (ext) {
    case '.pdf':
      const loader = new PDFBytesLoader(filepathOrBlob);
      return await loader.extractMeta();
    case '.md':
      const mdLoader = new MarkdownTextLoader(filepathOrBlob);
      return await mdLoader.extractMeta();
    case '.txt':
    default:
      const textLoader = new TextLoader(filepathOrBlob);
      return await textLoader.extractMeta();
  }
}
