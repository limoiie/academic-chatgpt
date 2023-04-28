-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DocumentChunk" (
    "no" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "meta" TEXT NOT NULL,
    "md5Hash" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,
    "splittingId" INTEGER NOT NULL,

    PRIMARY KEY ("documentId", "splittingId", "no"),
    CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentChunk_splittingId_fkey" FOREIGN KEY ("splittingId") REFERENCES "Splitting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DocumentChunk" ("content", "documentId", "md5Hash", "meta", "no", "splittingId") SELECT "content", "documentId", "md5Hash", "meta", "no", "splittingId" FROM "DocumentChunk";
DROP TABLE "DocumentChunk";
ALTER TABLE "new_DocumentChunk" RENAME TO "DocumentChunk";
CREATE TABLE "new_SplittingsOnDocuments" (
    "splittingId" INTEGER NOT NULL,
    "documentId" INTEGER NOT NULL,

    PRIMARY KEY ("splittingId", "documentId"),
    CONSTRAINT "SplittingsOnDocuments_splittingId_fkey" FOREIGN KEY ("splittingId") REFERENCES "Splitting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SplittingsOnDocuments_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SplittingsOnDocuments" ("documentId", "splittingId") SELECT "documentId", "splittingId" FROM "SplittingsOnDocuments";
DROP TABLE "SplittingsOnDocuments";
ALTER TABLE "new_SplittingsOnDocuments" RENAME TO "SplittingsOnDocuments";
CREATE TABLE "new_CollectionIndex" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "collectionId" INTEGER NOT NULL,
    "indexId" INTEGER NOT NULL,
    CONSTRAINT "CollectionIndex_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollectionIndex_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "IndexProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CollectionIndex" ("collectionId", "id", "indexId", "name") SELECT "collectionId", "id", "indexId", "name" FROM "CollectionIndex";
DROP TABLE "CollectionIndex";
ALTER TABLE "new_CollectionIndex" RENAME TO "CollectionIndex";
CREATE UNIQUE INDEX "CollectionIndex_collectionId_name_key" ON "CollectionIndex"("collectionId", "name");
CREATE TABLE "new_Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "history" TEXT NOT NULL,
    "indexId" TEXT NOT NULL,
    CONSTRAINT "Session_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "CollectionIndex" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("history", "id", "indexId", "name") SELECT "history", "id", "indexId", "name" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE TABLE "new_CollectionIndexOnDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "indexId" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,
    CONSTRAINT "CollectionIndexOnDocument_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "CollectionIndex" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollectionIndexOnDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CollectionIndexOnDocument" ("documentId", "id", "indexId") SELECT "documentId", "id", "indexId" FROM "CollectionIndexOnDocument";
DROP TABLE "CollectionIndexOnDocument";
ALTER TABLE "new_CollectionIndexOnDocument" RENAME TO "CollectionIndexOnDocument";
CREATE UNIQUE INDEX "CollectionIndexOnDocument_indexId_documentId_key" ON "CollectionIndexOnDocument"("indexId", "documentId");
CREATE TABLE "new_CollectionsOnDocuments" (
    "collectionId" INTEGER NOT NULL,
    "documentId" INTEGER NOT NULL,

    PRIMARY KEY ("collectionId", "documentId"),
    CONSTRAINT "CollectionsOnDocuments_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CollectionsOnDocuments_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CollectionsOnDocuments" ("collectionId", "documentId") SELECT "collectionId", "documentId" FROM "CollectionsOnDocuments";
DROP TABLE "CollectionsOnDocuments";
ALTER TABLE "new_CollectionsOnDocuments" RENAME TO "CollectionsOnDocuments";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
