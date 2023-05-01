import { extname } from 'pathe';
import { BaseDocumentSummarizer } from '~/utils/documentSummarizers/base';
import { MarkdownTextSummarizer } from '~/utils/documentSummarizers/markdown';
import { PDFBytesSummarizer } from '~/utils/documentSummarizers/pdf';
import { TextSummarizer } from '~/utils/documentSummarizers/text';

export class DocumentSummarizerFactory {
  static async make(filepathOrBlob: string | Blob, ext?: string): Promise<BaseDocumentSummarizer> {
    if (typeof filepathOrBlob === 'string') {
      ext = ext || extname(filepathOrBlob);
    }

    switch (ext) {
      case '.pdf':
        return new PDFBytesSummarizer(filepathOrBlob);
      case '.md':
        return new MarkdownTextSummarizer(filepathOrBlob);
      case '.txt':
      default:
        return new TextSummarizer(filepathOrBlob);
    }
  }
}
