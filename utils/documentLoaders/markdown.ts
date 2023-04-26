import { MarkdownTextSplitter, TextSplitter } from 'langchain/text_splitter';
import { TextLoader } from '~/utils/documentLoaders/text';

export class MarkdownTextLoader extends TextLoader {
  constructor(filePathOrBlob: string | Blob) {
    super(filePathOrBlob);
  }

  async loadAndSplit(splitter: TextSplitter = new MarkdownTextSplitter()) {
    const docs = await this.load();
    return splitter.splitDocuments(docs);
  }

  async extractMeta(): Promise<Record<string, any>> {
    const { text, metadata } = await this.open();
    return {
      ...metadata,
      md: {
        length: text.length,
      },
    };
  }
}
