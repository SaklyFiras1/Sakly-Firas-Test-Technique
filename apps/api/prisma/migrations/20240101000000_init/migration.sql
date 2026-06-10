-- CreateEnum
CREATE TYPE "Status" AS ENUM ('UPLOADED', 'PARSING', 'PARSED', 'READY', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "document_intake" (
    "id" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'UPLOADED',
    "sourceFilename" TEXT NOT NULL,
    "sourceMimeType" TEXT NOT NULL,
    "sourceStorageKey" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "generatedTitle" TEXT,
    "generatedSummary" TEXT,
    "generatedBodyHtml" TEXT,
    "detectedLanguage" TEXT,
    "editedTitle" TEXT,
    "editedSummary" TEXT,
    "editedBodyHtml" TEXT,
    "editedLanguage" TEXT,
    "parserVersion" TEXT,
    "parseWarnings" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedArticleId" TEXT,

    CONSTRAINT "document_intake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "published_article" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "published_article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "published_article_slug_key" ON "published_article"("slug");

-- AddForeignKey
ALTER TABLE "document_intake" ADD CONSTRAINT "document_intake_publishedArticleId_fkey"
    FOREIGN KEY ("publishedArticleId") REFERENCES "published_article"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
