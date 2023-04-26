import { Document } from 'langchain/docstore';
import { RecursiveCharacterTextSplitter, TextSplitter } from 'langchain/text_splitter';

export abstract class BaseDocumentLoader {
  async loadAndSplit(splitter: TextSplitter = new RecursiveCharacterTextSplitter()) {
    const docs = await this.load();
    return splitter.splitDocuments(docs);
  }

  abstract load(): Promise<Document[]>;

  abstract extractMeta(): Promise<Record<string, any>>;
}
