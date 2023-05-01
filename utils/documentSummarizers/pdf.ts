import { getDocument, version } from 'pdfjs-dist';
import { BytesSummarizer } from '~/utils/documentSummarizers/bytes';

export class PDFBytesSummarizer extends BytesSummarizer {
  splitPages: boolean;

  constructor(filePathOrBlob: string | Blob, fileName?: string, { splitPages = true } = {}) {
    super(filePathOrBlob);
    this.splitPages = splitPages;
  }

  async summarizeFromBuffer(data: Uint8Array, metadata: Record<string, any>) {
    const pdf = await getDocument({
      data: data,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    const meta = await pdf.getMetadata().catch(() => null);
    const outline = await pdf.getOutline().catch(() => null);

    const title = ((meta?.info as any)?.Title as string) || 'Untitled';
    return `This document "${title}" is a PDF file with ${pdf.numPages} pages. \
    Its outline is:\n${summarizeOutline(title, outline)}`;
  }

  async extractMetadataFromBuffer(data: Uint8Array, metadata: Record<string, any>) {
    const pdf = await getDocument({
      data: data,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    const meta = await pdf.getMetadata().catch(() => null);
    const outline = await pdf.getOutline().catch(() => null);
    return {
      ...metadata,
      type: 'pdf',
      pdf: {
        version,
        info: meta?.info,
        metadata: meta?.metadata,
        outline: outline,
        totalPages: pdf.numPages,
      },
    };
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
