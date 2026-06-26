-- CreateEnum
CREATE TYPE "SubtitleLanguage" AS ENUM ('EN', 'ES');

-- AlterTable
ALTER TABLE "upload_jobs" ADD COLUMN "language" "SubtitleLanguage" NOT NULL DEFAULT 'EN';

-- AlterTable
ALTER TABLE "video_sources" ADD COLUMN "language" "SubtitleLanguage" NOT NULL DEFAULT 'EN';

-- DropIndex
DROP INDEX "video_sources_episode_id_provider_key";

-- CreateIndex
CREATE UNIQUE INDEX "video_sources_episode_id_provider_language_key" ON "video_sources"("episode_id", "provider", "language");
