export const UPLOAD_QUEUE = 'upload';
export const STATS_QUEUE = 'stats';

export interface UploadJobData {
  uploadJobId: string;
}

export interface StatsJobData {
  scope: 'all' | 'anime';
  animeId?: string;
}
