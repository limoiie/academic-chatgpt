import { Document } from 'langchain/docstore';
import { getDocument, version } from 'pdfjs-dist';
import { BytesLoader } from '~/utils/documentLoaders/bytes';
import { recCleanNoneProperty } from '~/utils/objects';

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
    metadata = recCleanNoneProperty({
      ...metadata,
      pdf: {
        version,
        info: meta?.info,
        metadata: meta?.metadata,
        totalPages: pdf.numPages,
      },
    });

    const documents = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((item) => (item as any).str).join('\n');
      documents.push(
        new Document({
          pageContent: text,
          metadata: {
            ...metadata,
            loc: {
              pageNumber: i,
            },
          },
        }),
      );
    }
    if (this.splitPages) {
      return documents;
    }
    return [
      new Document({
        pageContent: documents.map((doc) => doc.pageContent).join('\n\n'),
        metadata,
      }),
    ];
  }
}
