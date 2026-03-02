import {
  ActionPanel,
  Action,
  List,
  showToast,
  showHUD,
  Toast,
  Icon,
  open,
  confirmAlert,
  Alert,
  popToRoot,
  closeMainWindow,
} from "@raycast/api";
import { exec } from "child_process";
import { useState, useEffect } from "react";
import { homedir } from "os";
import { join } from "path";
import { readdir, stat, unlink } from "fs/promises";
import { getObsidianInboxPath } from "./lib/obsidian";
import { createJob } from "./lib/jobs";
import { MediaFile } from "./types";

const DEFAULT_MEDIA_DIR = join(homedir(), "dwhelper");

function getMediaDir(): string {
  if (process.env.MEDIA_DIR) {
    return process.env.MEDIA_DIR.replace(/^~/, homedir());
  }
  return DEFAULT_MEDIA_DIR;
}

const MEDIA_DIR = getMediaDir();
const SUPPORTED_EXTENSIONS = [".mp3", ".mp4", ".webm", ".m4a", ".wav", ".ogg"];
const SCRIPT_PATH = join(
  homedir(),
  "Developer/nexus/mediascribe/scripts/transcribe-local.sh",
);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadMediaFiles(): Promise<MediaFile[]> {
  try {
    const files = await readdir(MEDIA_DIR);
    const mediaFiles: MediaFile[] = [];

    for (const file of files) {
      const ext = file.substring(file.lastIndexOf(".")).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext)) continue;

      const filePath = join(MEDIA_DIR, file);
      const stats = await stat(filePath);

      mediaFiles.push({
        name: file,
        path: filePath,
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        date: stats.mtime,
        extension: ext,
      });
    }

    return mediaFiles.sort((a, b) => b.date.getTime() - a.date.getTime());
  } catch (error) {
    console.error("Error loading media files:", error);
    return [];
  }
}

export function LocalTranscribe({
  onBack,
}: {
  onBack: () => void;
}) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMediaFiles().then((f) => {
      setFiles(f);
      setIsLoading(false);
    });
  }, []);

  const handleTranscribe = async (file: MediaFile) => {
    // Create job for tracking
    const job = await createJob(file.name, file.path, "local");

    // Launch script with nohup (same pattern as YouTube which works)
    const escapedPath = file.path.replace(/'/g, "'\\''");
    const cmd = `nohup "${SCRIPT_PATH}" '${escapedPath}' '${job.id}' > /dev/null 2>&1 &`;
    exec(cmd);

    // Show HUD and close Raycast immediately
    await showHUD(`🎙️ Transcription lancée: ${file.name}`);
    await closeMainWindow();
    await popToRoot();
  };

  const handleDelete = async (file: MediaFile) => {
    const confirmed = await confirmAlert({
      title: "Supprimer le fichier ?",
      message: `${file.name} sera supprimé définitivement.`,
      primaryAction: {
        title: "Supprimer",
        style: Alert.ActionStyle.Destructive,
      },
    });

    if (confirmed) {
      await unlink(file.path);
      setFiles(files.filter((f) => f.path !== file.path));
      await showToast({
        style: Toast.Style.Success,
        title: "Fichier supprimé",
      });
    }
  };

  const refresh = async () => {
    setIsLoading(true);
    const f = await loadMediaFiles();
    setFiles(f);
    setIsLoading(false);
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Rechercher un fichier...">
      {files.length === 0 && !isLoading ? (
        <List.EmptyView
          title="Aucun fichier média"
          description={`Aucun fichier trouvé dans ${MEDIA_DIR}`}
          icon={Icon.Video}
        />
      ) : (
        files.map((file) => (
          <List.Item
            key={file.path}
            title={file.name}
            subtitle={file.sizeFormatted}
            accessories={[
              {
                date: file.date,
                tooltip: file.date.toLocaleString("fr-FR"),
              },
            ]}
            icon={
              file.extension === ".mp4" || file.extension === ".webm"
                ? Icon.Video
                : Icon.Music
            }
            actions={
              <ActionPanel>
                <Action
                  title="Transcrire"
                  icon={Icon.Text}
                  onAction={() => handleTranscribe(file)}
                />
                <Action
                  title="Retour"
                  icon={Icon.ArrowLeft}
                  shortcut={{ modifiers: ["cmd"], key: "b" }}
                  onAction={onBack}
                />
                <Action
                  title="Ouvrir le dossier"
                  icon={Icon.Folder}
                  shortcut={{ modifiers: ["cmd"], key: "o" }}
                  onAction={() => open(MEDIA_DIR)}
                />
                <Action
                  title="Ouvrir Obsidian Inbox"
                  icon={Icon.Document}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "o" }}
                  onAction={() => open(getObsidianInboxPath())}
                />
                <Action
                  title="Rafraîchir"
                  icon={Icon.ArrowClockwise}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                  onAction={refresh}
                />
                <Action
                  title="Supprimer"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  shortcut={{ modifiers: ["cmd"], key: "backspace" }}
                  onAction={() => handleDelete(file)}
                />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
