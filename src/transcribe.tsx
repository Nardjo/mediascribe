import { ActionPanel, Action, List, Icon } from "@raycast/api";
import { useState } from "react";
import { TranscriptionMode } from "./types";
import { LocalTranscribe } from "./local-transcribe";
import { YouTubeTranscribe } from "./youtube-transcribe";

export default function Command() {
  const [mode, setMode] = useState<TranscriptionMode | null>(null);

  if (mode === "local") {
    return <LocalTranscribe onBack={() => setMode(null)} />;
  }

  if (mode === "youtube") {
    return <YouTubeTranscribe onBack={() => setMode(null)} />;
  }

  return (
    <List searchBarPlaceholder="Choisissez un mode de transcription...">
      <List.Item
        title="YouTube URL"
        subtitle="Transcrire une vidéo YouTube depuis son URL"
        icon={Icon.Video}
        actions={
          <ActionPanel>
            <Action
              title="Sélectionner"
              icon={Icon.CheckCircle}
              onAction={() => setMode("youtube")}
            />
          </ActionPanel>
        }
      />
      <List.Item
        title="Fichier Local"
        subtitle="Transcrire un fichier audio/vidéo depuis ~/dwhelper"
        icon={Icon.Document}
        actions={
          <ActionPanel>
            <Action
              title="Sélectionner"
              icon={Icon.CheckCircle}
              onAction={() => setMode("local")}
            />
          </ActionPanel>
        }
      />
    </List>
  );
}
