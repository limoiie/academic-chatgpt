import { readBinaryFile } from '@tauri-apps/api/fs';
import { Document } from 'langchain/docstore';
import { RecursiveCharacterTextSplitter, TextSplitter } from 'langchain/text_splitter';
import { getDocument, version } from 'pdfjs-dist';
import { recCleanNoneProperty } from '~/utils/objects';

export abstract class BaseDocumentLoader {
  async loadAndSplit(splitter: TextSplitter = new RecursiveCharacterTextSplitter()) {
    const docs = await this.load();
    return splitter.splitDocuments(docs);
  }

  abstract load(): Promise<Document[]>;
}

export abstract class BytesLoader extends BaseDocumentLoader {
  filePathOrBlob: string | Blob;

  protected constructor(filePathOrBlob: string | Blob) {
    super();
    this.filePathOrBlob = filePathOrBlob;
  }

  async load() {
    let bytes;
    let metadata;
    if (typeof this.filePathOrBlob === 'string') {
      bytes = await readBinaryFile(this.filePathOrBlob);
      metadata = { source: this.filePathOrBlob };
    } else {
      bytes = await this.filePathOrBlob.arrayBuffer().then((arr) => new Uint8Array(arr));
      metadata = { source: 'blob', blobType: this.filePathOrBlob.type };
    }
    return this.parse(bytes, metadata);
  }

  abstract parse(data: Uint8Array, metadata: Record<string, any>): Promise<Document[]>;
}

export class PDFBytesLoader extends BytesLoader {
  splitPages: boolean;

  constructor(filePathOrBlob: string | Blob, { splitPages = true } = {}) {
    super(filePathOrBlob);
    this.splitPages = splitPages;
  }

  async parse(data: Uint8Array, metadata: Record<string, any>) {
    const pdf = await getDocument({
      data: data,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
    const meta = await pdf.getMetadata().catch(() => null);
    const documents = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item) => (item as any).str).join('\n');
      documents.push(
        new Document({
          pageContent: text,
          metadata: recCleanNoneProperty({
            ...metadata,
            pdf: {
              version,
              info: meta?.info,
              metadata: meta?.metadata,
              totalPages: pdf.numPages,
            },
            loc: {
              pageNumber: i,
            },
          }),
        }),
      );
    }
    if (this.splitPages) {
      return documents;
    }
    return [
      new Document({
        pageContent: documents.map((doc) => doc.pageContent).join('\n\n'),
        metadata: recCleanNoneProperty({
          ...metadata,
          pdf: {
            version,
            info: meta?.info,
            metadata: meta?.metadata,
            totalPages: pdf.numPages,
          },
        }),
      }),
    ];
  }
}
