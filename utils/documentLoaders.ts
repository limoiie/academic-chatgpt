import { CharacterTextSplitter, RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { extname } from 'pathe';
import { Document, Splitting } from '~/plugins/tauri/bindings';
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

export async function summarizeCollection(allDocumentsInCollection: Document[]) {
  const metadataList = await Promise.all(
    allDocumentsInCollection
      .map((document) => {
        return {
          filepath: document.filepath,
          filename: document.filename,
          ext: extname(document.filename),
        };
      })
      .sort((a, b) => {
        return `${a.filename}-${a.ext}`.localeCompare(`${b.filename}-${b.ext}`);
      })
      .map(async ({ filepath, filename, ext }) => {
        return {
          ...(await extractMetadata(filepath, ext)),
          filename,
        };
      }),
  );

  const content = metadataList
    .map((metadata, i) => {
      const { filename, ...rest } = metadata;
      return `- Document ${i + 1}: ${filename}`;
    })
    .join('\n');

  return `# Documents Collection Summary
This collection consists of ${allDocumentsInCollection.length} documents:
${content}`;
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
