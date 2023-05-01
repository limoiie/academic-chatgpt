import { Document } from 'langchain/docstore';
import { BaseDocumentLoader } from '~/utils/documentLoaders/base';
import { openBinaryDocument } from '~/utils/documentOpeners/bytes';

export abstract class BytesLoader extends BaseDocumentLoader {
  filePathOrBlob: string | Blob;

  protected constructor(filePathOrBlob: string | Blob) {
    super();
    this.filePathOrBlob = filePathOrBlob;
  }

  async load() {
    const { bytes, metadata } = await openBinaryDocument(this.filePathOrBlob);
    return this.parse(bytes, metadata);
  }

  abstract parse(data: Uint8Array, metadata: Record<string, any>): Promise<Document[]>;
}
