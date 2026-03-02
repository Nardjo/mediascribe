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

export type TranscriptionMode = "local" | "youtube";

export interface YouTubeResult {
  title: string;
  outputPath: string;
  videoId: string;
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
  source: "local" | "youtube";
  status: JobStatus;
  startTime: number;
  endTime?: number;
  error?: string;
}
