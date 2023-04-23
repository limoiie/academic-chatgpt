-- CreateTable
CREATE TABLE "DocumentChunk" (
    "no" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "meta" TEXT NOT NULL,
    "md5Hash" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,
    "splittingId" INTEGER NOT NULL,

    PRIMARY KEY ("documentId", "splittingId", "no"),
    CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DocumentChunk_splittingId_fkey" FOREIGN KEY ("splittingId") REFERENCES "Splitting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Splitting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chunkSize" INTEGER NOT NULL,
    "chunkOverlap" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "SplittingsOnDocuments" (
    "splittingId" INTEGER NOT NULL,
    "documentId" INTEGER NOT NULL,

    PRIMARY KEY ("splittingId", "documentId"),
    CONSTRAINT "SplittingsOnDocuments_splittingId_fkey" FOREIGN KEY ("splittingId") REFERENCES "Splitting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SplittingsOnDocuments_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "md5Hash" TEXT NOT NULL,
    "updateTime" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CollectionsOnDocuments" (
    "collectionId" INTEGER NOT NULL,
    "documentId" INTEGER NOT NULL,

    PRIMARY KEY ("collectionId", "documentId"),
    CONSTRAINT "CollectionsOnDocuments_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CollectionsOnDocuments_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmbeddingsClient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "info" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "EmbeddingsConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "clientType" TEXT NOT NULL,
    "meta" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "EmbeddingVectorsOnDocumentChunks" (
    "md5Hash" TEXT NOT NULL,
    "vector" BLOB NOT NULL,
    "embeddingsConfigId" INTEGER NOT NULL,

    PRIMARY KEY ("embeddingsConfigId", "md5Hash"),
    CONSTRAINT "EmbeddingVectorsOnDocumentChunks_embeddingsConfigId_fkey" FOREIGN KEY ("embeddingsConfigId") REFERENCES "EmbeddingsConfig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VectorDbClient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "info" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "VectorDbConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "clientType" TEXT NOT NULL,
    "meta" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "IndexProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "splittingId" INTEGER NOT NULL,
    "embeddingsClientId" INTEGER NOT NULL,
    "embeddingsConfigId" INTEGER NOT NULL,
    "vectorDbClientId" INTEGER NOT NULL,
    "vectorDbConfigId" INTEGER NOT NULL,
    CONSTRAINT "IndexProfile_splittingId_fkey" FOREIGN KEY ("splittingId") REFERENCES "Splitting" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IndexProfile_embeddingsClientId_fkey" FOREIGN KEY ("embeddingsClientId") REFERENCES "EmbeddingsClient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IndexProfile_embeddingsConfigId_fkey" FOREIGN KEY ("embeddingsConfigId") REFERENCES "EmbeddingsConfig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IndexProfile_vectorDbClientId_fkey" FOREIGN KEY ("vectorDbClientId") REFERENCES "VectorDbClient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IndexProfile_vectorDbConfigId_fkey" FOREIGN KEY ("vectorDbConfigId") REFERENCES "VectorDbConfig" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectionIndex" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "collectionId" INTEGER NOT NULL,
    "indexId" INTEGER NOT NULL,
    CONSTRAINT "CollectionIndex_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CollectionIndex_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "IndexProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectionIndexOnDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "indexId" TEXT NOT NULL,
    "documentId" INTEGER NOT NULL,
    CONSTRAINT "CollectionIndexOnDocument_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "CollectionIndex" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CollectionIndexOnDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "history" TEXT NOT NULL,
    "indexId" TEXT NOT NULL,
    CONSTRAINT "Session_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "CollectionIndex" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Splitting_chunkOverlap_chunkSize_key" ON "Splitting"("chunkOverlap", "chunkSize");

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddingsClient_type_info_key" ON "EmbeddingsClient"("type", "info");

-- CreateIndex
CREATE UNIQUE INDEX "VectorDbClient_type_info_key" ON "VectorDbClient"("type", "info");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionIndex_collectionId_name_key" ON "CollectionIndex"("collectionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionIndexOnDocument_indexId_documentId_key" ON "CollectionIndexOnDocument"("indexId", "documentId");
