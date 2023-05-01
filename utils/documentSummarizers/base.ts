export abstract class BaseDocumentSummarizer {
  abstract summarize(): Promise<string>;
  abstract extractMetadata(): Promise<Record<string, any>>;
}
