import { readTextFile } from '@tauri-apps/api/fs';
import { Document } from 'langchain/docstore';
import { BaseDocumentLoader } from '~/utils/documentLoaders/base';

export class TextLoader extends BaseDocumentLoader {
  constructor(public filePathOrBlob: string | Blob) {
    super();
  }

  async load() {
    const { text, metadata } = await this.open();
    const parsed = await this.parse(text);
    return parsed.map(
      (pageContent, i) =>
        new Document({
          pageContent,
          metadata:
            parsed.length === 1
              ? metadata
              : {
                  ...metadata,
                  line: i + 1,
                },
        }),
    );
  }

  async extractMeta(): Promise<Record<string, any>> {
    const { text, metadata } = await this.open();
    return {
      ...metadata,
      txt: {
        length: text.length,
      },
    };
  }

  async open() {
    let text;
    let metadata: { source: string; [key: string]: any } = { source: '' };
    if (typeof this.filePathOrBlob === 'string') {
      text = await readTextFile(this.filePathOrBlob);
      metadata = { source: this.filePathOrBlob };
    } else {
      text = await this.filePathOrBlob.text();
      metadata = { source: 'blob', blobType: this.filePathOrBlob.type };
    }
    return { text, metadata };
  }

  async parse(raw: string): Promise<string[]> {
    return [raw];
  }
}
