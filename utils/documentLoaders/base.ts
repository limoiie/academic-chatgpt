import { Document } from 'langchain/docstore';
import { RecursiveCharacterTextSplitter, TextSplitter } from 'langchain/text_splitter';
import { Splitting } from "~/plugins/tauri/bindings";

export abstract class BaseDocumentLoader {
  async loadAndSplit(splitter: TextSplitter = new RecursiveCharacterTextSplitter()) {
    const docs = await this.load();
    return splitter.splitDocuments(docs);
  }

  abstract load(): Promise<Document[]>;
}

export abstract class DocumentLoader {
  abstract loadAndSplit(filepathOrBlob: string | Blob, splitting: Splitting, ext?: string): Promise<Document[]>;
}
