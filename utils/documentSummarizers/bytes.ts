import { readBinaryFile } from '@tauri-apps/api/fs';
import { BaseDocumentSummarizer } from '~/utils/documentSummarizers/base';

export abstract class BytesSummarizer extends BaseDocumentSummarizer {
  protected constructor(public filePathOrBlob: string | Blob) {
    super();
  }

  async summarize() {
    const { bytes, metadata } = await this.open();
    return this.summarizeFromBuffer(bytes, metadata);
  }

  async extractMetadata() {
    const { bytes, metadata } = await this.open();
    return this.extractMetadataFromBuffer(bytes, metadata);
  }

  abstract summarizeFromBuffer(data: Uint8Array, metadata: Record<string, any>): Promise<string>;

  abstract extractMetadataFromBuffer(data: Uint8Array, metadata: Record<string, any>): Promise<Record<string, any>>;

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
