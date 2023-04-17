import { CollectionIndexWithAll, Document } from '~/utils/bindings';

export class IndexSyncStatus {
  constructor(
    /**
     * List of document ids to delete from the index.
     */
    public toDeleted: number[],
    /**
     * List of documents to index.
     */
    public toIndexed: Document[],
  ) {}

  /**
   * Returns true if there is nothing to do.
   */
  get clean() {
    return this.toDeleted.length == 0 && this.toIndexed.length == 0;
  }

  /**
   * Compute the sync status from the given documents and index profile.
   *
   * @param documents
   * @param index
   */
  static compute(documents: Document[], index: CollectionIndexWithAll) {
    const indexed: Set<number> = new Set(index.indexedDocuments.map((d) => d.documentId));
    const toIndexed = documents.filter((document) => {
      if (indexed.has(document.id)) {
        indexed.delete(document.id);
        return false;
      }
      return true;
    });
    const toDeleted = [...indexed];
    return new IndexSyncStatus(toDeleted, toIndexed);
  }
}
