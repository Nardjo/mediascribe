import {
  ActionPanel,
  Action,
  List,
  Icon,
  showToast,
  Toast,
  Color,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { TranscriptionJob, JobStatus } from "./types";
import {
  loadJobs,
  removeJob,
  clearCompletedJobs,
  getStatusLabel,
} from "./lib/jobs";

function getStatusIcon(status: JobStatus): { source: Icon; tintColor: Color } {
  const config: Record<JobStatus, { source: Icon; tintColor: Color }> = {
    pending: { source: Icon.Clock, tintColor: Color.SecondaryText },
    transcribing: { source: Icon.Waveform, tintColor: Color.Blue },
    summarizing: { source: Icon.LightBulb, tintColor: Color.Purple },
    saving: { source: Icon.Document, tintColor: Color.Orange },
    completed: { source: Icon.CheckCircle, tintColor: Color.Green },
    failed: { source: Icon.XMarkCircle, tintColor: Color.Red },
  };
  return config[status];
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Jobs() {
  const [jobs, setJobs] = useState<TranscriptionJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    setIsLoading(true);
    const loadedJobs = await loadJobs();
    // Sort by startTime descending (most recent first)
    setJobs(loadedJobs.sort((a, b) => b.startTime - a.startTime));
    setIsLoading(false);
  };

  useEffect(() => {
    refresh();
    // Auto-refresh every 2 seconds for active jobs
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleRemove = async (job: TranscriptionJob) => {
    await removeJob(job.id);
    await refresh();
    await showToast({ style: Toast.Style.Success, title: "Job supprimé" });
  };

  const handleClearCompleted = async () => {
    await clearCompletedJobs();
    await refresh();
    await showToast({
      style: Toast.Style.Success,
      title: "Jobs terminés supprimés",
    });
  };

  const activeJobs = jobs.filter(
    (j) => !["completed", "failed"].includes(j.status),
  );
  const completedJobs = jobs.filter((j) =>
    ["completed", "failed"].includes(j.status),
  );

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Rechercher une transcription..."
    >
      {jobs.length === 0 && !isLoading ? (
        <List.EmptyView
          title="Aucune transcription"
          description="Lance une transcription depuis 'Transcribe Media'"
          icon={Icon.Waveform}
        />
      ) : (
        <>
          {activeJobs.length > 0 && (
            <List.Section
              title="En cours"
              subtitle={`${activeJobs.length} job(s)`}
            >
              {activeJobs.map((job) => (
                <List.Item
                  key={job.id}
                  title={job.fileName}
                  subtitle={getStatusLabel(job.status)}
                  icon={getStatusIcon(job.status)}
                  accessories={[
                    {
                      text: formatTime(job.startTime),
                      tooltip: "Heure de début",
                    },
                    {
                      text: formatDuration(Date.now() - job.startTime),
                      tooltip: "Durée",
                    },
                    {
                      tag: {
                        value: job.source === "youtube" ? "YouTube" : "Local",
                        color:
                          job.source === "youtube" ? Color.Red : Color.Blue,
                      },
                    },
                  ]}
                  actions={
                    <ActionPanel>
                      <Action
                        title="Rafraîchir"
                        icon={Icon.ArrowClockwise}
                        shortcut={{ modifiers: ["cmd"], key: "r" }}
                        onAction={refresh}
                      />
                    </ActionPanel>
                  }
                />
              ))}
            </List.Section>
          )}

          {completedJobs.length > 0 && (
            <List.Section
              title="Terminées"
              subtitle={`${completedJobs.length} job(s)`}
            >
              {completedJobs.map((job) => (
                <List.Item
                  key={job.id}
                  title={job.fileName}
                  subtitle={job.error || getStatusLabel(job.status)}
                  icon={getStatusIcon(job.status)}
                  accessories={[
                    { text: formatTime(job.startTime) },
                    {
                      text: job.endTime
                        ? formatDuration(job.endTime - job.startTime)
                        : "-",
                      tooltip: "Durée totale",
                    },
                    {
                      tag: {
                        value: job.source === "youtube" ? "YouTube" : "Local",
                        color:
                          job.source === "youtube" ? Color.Red : Color.Blue,
                      },
                    },
                  ]}
                  actions={
                    <ActionPanel>
                      <Action
                        title="Supprimer"
                        icon={Icon.Trash}
                        style={Action.Style.Destructive}
                        onAction={() => handleRemove(job)}
                      />
                      <Action
                        title="Supprimer tous les terminés"
                        icon={Icon.Trash}
                        style={Action.Style.Destructive}
                        shortcut={{
                          modifiers: ["cmd", "shift"],
                          key: "backspace",
                        }}
                        onAction={handleClearCompleted}
                      />
                      <Action
                        title="Rafraîchir"
                        icon={Icon.ArrowClockwise}
                        shortcut={{ modifiers: ["cmd"], key: "r" }}
                        onAction={refresh}
                      />
                    </ActionPanel>
                  }
                />
              ))}
            </List.Section>
          )}
        </>
      )}
    </List>
  );
}
