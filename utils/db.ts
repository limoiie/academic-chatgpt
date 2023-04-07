import { Document as DocumentPart } from 'langchain/docstore';
import { CreateChunkData, DocumentChunk } from '~/utils/bindings';

export function dbDocumentChunk2Ui(document: DocumentChunk) {
  const metadata = JSON.parse(document.meta);
  return new DocumentPart({
    pageContent: document.content,
    metadata: metadata,
  });
}

export function uiDocumentChunks2Db(document: DocumentPart) {
  return {
    content: document.pageContent,
    metadata: JSON.stringify(document.metadata),
  } as CreateChunkData;
}
