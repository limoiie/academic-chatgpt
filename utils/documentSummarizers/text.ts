import { readTextFile } from '@tauri-apps/api/fs';
import { BaseDocumentSummarizer } from '~/utils/documentSummarizers/base';

export class TextSummarizer extends BaseDocumentSummarizer {
  constructor(public filePathOrBlob: string | Blob) {
    super();
  }

  async summarize() {
    const { text, metadata } = await this.open();
    return `This document is a text file with ${text.length} characters. \
    Its metadata is:\n${JSON.stringify(metadata)}.`;
  }

  async extractMetadata() {
    const { text, metadata } = await this.open();
    return {
      ...metadata,
      type: 'txt',
      txt: {
        length: text.length,
      },
    };
  }

  async open() {
    let text;
    let metadata: { source: string; [key: string]: any };
    if (typeof this.filePathOrBlob === 'string') {
      text = await readTextFile(this.filePathOrBlob);
      metadata = { source: this.filePathOrBlob };
    } else {
      text = await this.filePathOrBlob.text();
      metadata = { source: 'blob', blobType: this.filePathOrBlob.type };
    }
    return { text, metadata };
  }
}
