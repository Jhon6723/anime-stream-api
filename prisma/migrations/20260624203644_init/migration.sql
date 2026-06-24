-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MODERATOR', 'UPLOADER', 'USER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');

-- CreateEnum
CREATE TYPE "AnimeStatus" AS ENUM ('ONGOING', 'COMPLETED', 'UPCOMING');

-- CreateEnum
CREATE TYPE "AnimeType" AS ENUM ('TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'WARNED', 'DISABLED');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('DOODSTREAM', 'MIXDROP', 'STREAMTAPE');

-- CreateEnum
CREATE TYPE "VideoSourceStatus" AS ENUM ('UPLOADING', 'ENCODING', 'READY', 'ERROR', 'DELETED');

-- CreateEnum
CREATE TYPE "UploadSourceType" AS ENUM ('LOCAL', 'REMOTE_URL');

-- CreateEnum
CREATE TYPE "UploadJobStatus" AS ENUM ('QUEUED', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ModerationAction" AS ENUM ('WARNING', 'DISABLE', 'RE_ENABLE', 'HARD_DELETE');

-- CreateEnum
CREATE TYPE "AdProvider" AS ENUM ('ADSENSE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AdPlacement" AS ENUM ('HEADER', 'SIDEBAR', 'IN_PLAYER', 'FOOTER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "approved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animes" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "synopsis" TEXT,
    "cover_image" TEXT,
    "banner_image" TEXT,
    "status" "AnimeStatus" NOT NULL DEFAULT 'ONGOING',
    "type" "AnimeType" NOT NULL DEFAULT 'TV',
    "genres" TEXT[],
    "studios" TEXT[],
    "total_episodes" INTEGER,
    "release_date" TIMESTAMP(3),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "jikan_id" INTEGER,
    "is_title_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" TEXT NOT NULL,
    "anime_id" TEXT NOT NULL,
    "episode_number" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "thumbnail_url" TEXT,
    "duration" INTEGER,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "jikan_episode_id" INTEGER,
    "is_filler" BOOLEAN NOT NULL DEFAULT false,
    "aired_date" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_sources" (
    "id" TEXT NOT NULL,
    "episode_id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "provider_file_id" TEXT,
    "embed_url" TEXT,
    "download_url" TEXT,
    "status" "VideoSourceStatus" NOT NULL DEFAULT 'UPLOADING',
    "views_count" BIGINT NOT NULL DEFAULT 0,
    "earnings_estimated" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "video_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_logs" (
    "id" TEXT NOT NULL,
    "anime_id" TEXT,
    "episode_id" TEXT,
    "moderator_id" TEXT NOT NULL,
    "action" "ModerationAction" NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_jobs" (
    "id" TEXT NOT NULL,
    "episode_id" TEXT NOT NULL,
    "video_source_id" TEXT,
    "provider" "Provider" NOT NULL,
    "source_type" "UploadSourceType" NOT NULL,
    "source_url" TEXT,
    "status" "UploadJobStatus" NOT NULL DEFAULT 'QUEUED',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "initiated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upload_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_configs" (
    "id" TEXT NOT NULL,
    "provider" "AdProvider" NOT NULL,
    "ad_code" TEXT NOT NULL,
    "placement" "AdPlacement" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_accounts" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "label" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "animes_slug_key" ON "animes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "animes_jikan_id_key" ON "animes"("jikan_id");

-- CreateIndex
CREATE INDEX "animes_status_idx" ON "animes"("status");

-- CreateIndex
CREATE INDEX "animes_type_idx" ON "animes"("type");

-- CreateIndex
CREATE INDEX "episodes_moderation_status_idx" ON "episodes"("moderation_status");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_anime_id_episode_number_key" ON "episodes"("anime_id", "episode_number");

-- CreateIndex
CREATE INDEX "video_sources_status_idx" ON "video_sources"("status");

-- CreateIndex
CREATE UNIQUE INDEX "video_sources_episode_id_provider_key" ON "video_sources"("episode_id", "provider");

-- CreateIndex
CREATE INDEX "moderation_logs_anime_id_idx" ON "moderation_logs"("anime_id");

-- CreateIndex
CREATE INDEX "moderation_logs_episode_id_idx" ON "moderation_logs"("episode_id");

-- CreateIndex
CREATE INDEX "upload_jobs_status_idx" ON "upload_jobs"("status");

-- CreateIndex
CREATE INDEX "ad_configs_placement_idx" ON "ad_configs"("placement");

-- CreateIndex
CREATE INDEX "provider_accounts_provider_is_active_idx" ON "provider_accounts"("provider", "is_active");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animes" ADD CONSTRAINT "animes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animes" ADD CONSTRAINT "animes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_anime_id_fkey" FOREIGN KEY ("anime_id") REFERENCES "animes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_sources" ADD CONSTRAINT "video_sources_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_anime_id_fkey" FOREIGN KEY ("anime_id") REFERENCES "animes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_jobs" ADD CONSTRAINT "upload_jobs_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_jobs" ADD CONSTRAINT "upload_jobs_video_source_id_fkey" FOREIGN KEY ("video_source_id") REFERENCES "video_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_jobs" ADD CONSTRAINT "upload_jobs_initiated_by_fkey" FOREIGN KEY ("initiated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_configs" ADD CONSTRAINT "ad_configs_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
