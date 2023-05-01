import { Collection, Document } from "~/plugins/tauri/bindings";

export abstract class CollectionSummarizer {
  abstract summarize(collection: Collection, documents: Document[]): Promise<string>;
}
