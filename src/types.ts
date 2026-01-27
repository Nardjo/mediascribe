export interface MediaFile {
  name: string;
  path: string;
  size: number;
  sizeFormatted: string;
  date: Date;
  extension: string;
}

export interface TranscriptionResult {
  text: string;
  summary: string;
  duration: number;
}

export type TranscriptionMode = "local" | "youtube" | "article";

export type OutputMode = "concept" | "article" | "both";

export interface YouTubeResult {
  title: string;
  outputPath: string;
  videoId: string;
}

export interface ReadwiseArticle {
  id: string;
  title: string;
  url: string;
  author?: string;
  source?: string;
  summary?: string;
  created_at: string;
  reading_progress: number;
}

export type JobStatus =
  | "pending"
  | "transcribing"
  | "summarizing"
  | "saving"
  | "completed"
  | "failed";

export interface TranscriptionJob {
  id: string;
  fileName: string;
  filePath: string;
  source: "local" | "youtube" | "article";
  status: JobStatus;
  startTime: number;
  endTime?: number;
  error?: string;
}
