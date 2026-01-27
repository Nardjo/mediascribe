import {
  ActionPanel,
  Action,
  Form,
  showHUD,
  Icon,
  open,
  popToRoot,
  closeMainWindow,
} from "@raycast/api";
import { exec } from "child_process";
import { useState } from "react";
import { homedir } from "os";
import { join } from "path";
import { isValidYouTubeUrl, extractVideoId } from "./lib/youtube";
import { getObsidianInboxPath } from "./lib/obsidian";
import { createJob } from "./lib/jobs";
import { OutputMode } from "./types";

const SCRIPT_PATH = join(
  homedir(),
  "Developer/PERSO/nexus/raycast-transcriber/scripts/transcribe-youtube.sh",
);

export function YouTubeTranscribe({
  outputMode,
  onBack,
}: {
  outputMode: OutputMode;
  onBack: () => void;
}) {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | undefined>();

  const handleSubmit = async () => {
    if (!isValidYouTubeUrl(url)) {
      setUrlError("URL YouTube invalide");
      return;
    }

    // Create job for tracking
    const videoId = extractVideoId(url) || "youtube";
    const job = await createJob(`YouTube: ${videoId}`, url, "youtube");

    // Launch script with nohup to survive Raycast closing
    const cmd = `nohup "${SCRIPT_PATH}" '${url}' '${job.id}' '${outputMode}' > /dev/null 2>&1 &`;
    exec(cmd);

    // Show HUD and close Raycast immediately
    await showHUD(`🎬 Transcription YouTube lancée`);
    await closeMainWindow();
    await popToRoot();
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Transcrire"
            icon={Icon.Text}
            onSubmit={handleSubmit}
          />
          <Action
            title="Retour"
            icon={Icon.ArrowLeft}
            shortcut={{ modifiers: ["cmd"], key: "b" }}
            onAction={onBack}
          />
          <Action
            title="Ouvrir Obsidian Inbox"
            icon={Icon.Document}
            shortcut={{ modifiers: ["cmd", "shift"], key: "o" }}
            onAction={() => open(getObsidianInboxPath())}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="url"
        title="URL YouTube"
        placeholder="https://www.youtube.com/watch?v=..."
        value={url}
        onChange={(value) => {
          setUrl(value);
          if (urlError) setUrlError(undefined);
        }}
        error={urlError}
      />
      <Form.Description text="Collez l'URL d'une vidéo YouTube. La transcription sera sauvegardée dans Obsidian (0 INBOX)." />
    </Form>
  );
}
