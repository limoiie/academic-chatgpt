import { readBinaryFile } from '@tauri-apps/api/fs';
import { Document } from 'langchain/docstore';
import { BaseDocumentLoader } from '~/utils/documentLoaders/base';

export abstract class BytesLoader extends BaseDocumentLoader {
  filePathOrBlob: string | Blob;

  protected constructor(filePathOrBlob: string | Blob) {
    super();
    this.filePathOrBlob = filePathOrBlob;
  }

  getTitle() {
    return typeof this.filePathOrBlob === 'string' ? this.filePathOrBlob : 'Blob';
  }

  async load() {
    const { bytes, metadata } = await this.open();
    return this.parse(bytes, metadata);
  }

  async extractMeta() {
    const { bytes, metadata } = await this.open();
    return this.parseMeta(bytes, metadata);
  }

  abstract parse(data: Uint8Array, metadata: Record<string, any>): Promise<Document[]>;

  abstract parseMeta(data: Uint8Array, metadata: Record<string, any>): Promise<Record<string, any>>;

  private async open() {
    let bytes;
    let metadata;
    if (typeof this.filePathOrBlob === 'string') {
      bytes = await readBinaryFile(this.filePathOrBlob);
      metadata = { source: this.filePathOrBlob };
    } else {
      bytes = await this.filePathOrBlob.arrayBuffer().then((arr) => new Uint8Array(arr));
      metadata = { source: 'blob', blobType: this.filePathOrBlob.type };
    }
    return { bytes, metadata };
  }
}
