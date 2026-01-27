import { homedir } from "os";
import { join } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import { TranscriptionJob, JobStatus } from "../types";

const CACHE_DIR = join(homedir(), ".cache", "raycast-transcriber");
const JOBS_FILE = join(CACHE_DIR, "jobs.json");

async function ensureCacheDir() {
  await mkdir(CACHE_DIR, { recursive: true });
}

export async function loadJobs(): Promise<TranscriptionJob[]> {
  try {
    await ensureCacheDir();
    const data = await readFile(JOBS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveJobs(jobs: TranscriptionJob[]) {
  await ensureCacheDir();
  await writeFile(JOBS_FILE, JSON.stringify(jobs, null, 2));
}

export async function createJob(
  fileName: string,
  filePath: string,
  source: "local" | "youtube" | "article",
): Promise<TranscriptionJob> {
  const jobs = await loadJobs();

  const job: TranscriptionJob = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fileName,
    filePath,
    source,
    status: "pending",
    startTime: Date.now(),
  };

  jobs.push(job);
  await saveJobs(jobs);

  return job;
}

export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  error?: string,
): Promise<void> {
  const jobs = await loadJobs();
  const job = jobs.find((j) => j.id === jobId);

  if (job) {
    job.status = status;
    if (status === "completed" || status === "failed") {
      job.endTime = Date.now();
    }
    if (error) {
      job.error = error;
    }
    await saveJobs(jobs);
  }
}

export async function removeJob(jobId: string): Promise<void> {
  const jobs = await loadJobs();
  const filtered = jobs.filter((j) => j.id !== jobId);
  await saveJobs(filtered);
}

export async function clearCompletedJobs(): Promise<void> {
  const jobs = await loadJobs();
  const active = jobs.filter(
    (j) => j.status !== "completed" && j.status !== "failed",
  );
  await saveJobs(active);
}

export function getStatusLabel(status: JobStatus): string {
  const labels: Record<JobStatus, string> = {
    pending: "En attente",
    transcribing: "Transcription...",
    summarizing: "Résumé en cours...",
    saving: "Sauvegarde...",
    completed: "Terminé",
    failed: "Erreur",
  };
  return labels[status];
}

export function getStatusIcon(status: JobStatus): string {
  const icons: Record<JobStatus, string> = {
    pending: "hourglass",
    transcribing: "waveform",
    summarizing: "brain",
    saving: "document",
    completed: "checkmark-circle",
    failed: "xmark-circle",
  };
  return icons[status];
}
