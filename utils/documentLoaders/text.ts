import { Document } from 'langchain/docstore';
import { BaseDocumentLoader } from '~/utils/documentLoaders/base';
import { openTextDocument } from '~/utils/documentOpeners/text';

export class TextLoader extends BaseDocumentLoader {
  constructor(public filePathOrBlob: string | Blob) {
    super();
  }

  async load() {
    const { text, metadata } = await openTextDocument(this.filePathOrBlob);
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

  async parse(raw: string): Promise<string[]> {
    return [raw];
  }
}
