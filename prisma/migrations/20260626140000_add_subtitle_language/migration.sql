-- CreateEnum
CREATE TYPE "SubtitleLanguage" AS ENUM ('EN', 'ES');

-- AlterTable
ALTER TABLE "upload_jobs" ADD COLUMN "language" "SubtitleLanguage" NOT NULL DEFAULT 'EN';

-- AlterTable
ALTER TABLE "video_sources" ADD COLUMN "language" "SubtitleLanguage" NOT NULL DEFAULT 'EN';

-- DropConstraint
ALTER TABLE "video_sources" DROP CONSTRAINT "video_sources_episode_id_provider_key";

-- CreateConstraint
ALTER TABLE "video_sources" ADD CONSTRAINT "video_sources_episode_id_provider_language_key" UNIQUE ("episode_id", "provider", "language");
