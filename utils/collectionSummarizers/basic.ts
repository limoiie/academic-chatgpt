import { extname } from 'pathe';
import { Collection, Document } from '~/plugins/tauri/bindings';
import { CollectionSummarizer } from '~/utils/collectionSummarizers/base';
import { DocumentSummarizerFactory } from '~/utils/documentSummarizers/factory';

export class BasicCollectionSummarizer extends CollectionSummarizer {
  async summarize(collection: Collection, documents: Document[]) {
    const documentSummaries = await Promise.all(
      documents
        .map((document) => {
          return {
            filepath: document.filepath,
            filename: document.filename,
            ext: extname(document.filename),
          };
        })
        .sort((a, b) => {
          return `${a.filename}-${a.ext}`.localeCompare(`${b.filename}-${b.ext}`);
        })
        .map(async ({ filepath, filename, ext }, i) => {
          const summarizer = await DocumentSummarizerFactory.make(filepath, ext);
          const summary = await summarizer.summarize();
          return `## Document ${i + 1}: ${filename}\n${summary}`;
        }),
    );

    return `# The Summary of Document Collection

This collection consists of ${documents.length} documents.

${documentSummaries.join('\n\n')}`;
  }
}
