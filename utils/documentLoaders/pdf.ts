import { Document } from 'langchain/docstore';
import { getDocument, PDFDocumentProxy, version } from 'pdfjs-dist';
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

    const summary = await this.summarize(pdf);
    const documents = summary
      ? [
          new Document({
            pageContent: summary,
            metadata,
          }),
        ]
      : [];

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

  async parseMeta(data: Uint8Array, metadata: Record<string, any>) {
    const pdf = await getDocument({
      data: data,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    const meta = await pdf.getMetadata().catch(() => null);
    return {
      ...metadata,
      pdf: {
        version,
        info: meta?.info,
        metadata: meta?.metadata,
        totalPages: pdf.numPages,
      },
    };
  }

  async summarize(pdf: PDFDocumentProxy) {
    const meta = await pdf.getMetadata().catch(() => null);
    const outline = await pdf.getOutline().catch(() => null);
    const title = ((meta?.info as any)?.Title as string) || this.getTitle();
    return `The document "${title}" has ${pdf.numPages} pages.
${summarizeOutline(title, outline)}`;
  }
}

interface PDFJSOutlineEntry {
  title: string;
  bold: boolean;
  italic: boolean;
  /**
   * - The color in RGB format to use for
   * display purposes.
   */
  color: Uint8ClampedArray;
  dest: string | Array<any> | null;
  url: string | null;
  unsafeUrl: string | undefined;
  newWindow: boolean | undefined;
  count: number | undefined;
  items: PDFJSOutlineEntry[];
}

function summarizeOutline(
  title: string,
  outlineEntries: PDFJSOutlineEntry[] | null,
  level = 'document',
  subLevel = 'section',
): string {
  if (outlineEntries == null || outlineEntries.length == 0) return '';

  const sections = outlineEntries.flatMap((e) => e.title);
  const content = `The ${level} "${title}" consists of ${sections.length} ${subLevel}s:\n${sections.join('\n')}`;

  return [
    content,
    ...outlineEntries.flatMap((outlineEntry) => {
      return summarizeOutline(outlineEntry.title, outlineEntry.items, subLevel, 'sub' + subLevel);
    }),
  ]
    .filter((e) => e != null && e !== '')
    .join('\n\n');
}
