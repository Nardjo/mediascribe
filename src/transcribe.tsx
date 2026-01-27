import { ActionPanel, Action, List, Icon } from "@raycast/api";
import { useState } from "react";
import { TranscriptionMode, OutputMode } from "./types";
import { LocalTranscribe } from "./local-transcribe";
import { YouTubeTranscribe } from "./youtube-transcribe";
import { ArticleTranscribe } from "./article-transcribe";

export default function Command() {
  const [mode, setMode] = useState<TranscriptionMode | null>(null);
  const [outputMode, setOutputMode] = useState<OutputMode | null>(null);

  if (mode === "local" && outputMode) {
    return (
      <LocalTranscribe
        outputMode={outputMode}
        onBack={() => {
          setMode(null);
          setOutputMode(null);
        }}
      />
    );
  }

  if (mode === "youtube" && outputMode) {
    return (
      <YouTubeTranscribe
        outputMode={outputMode}
        onBack={() => {
          setMode(null);
          setOutputMode(null);
        }}
      />
    );
  }

  if (mode === "article" && outputMode) {
    return (
      <ArticleTranscribe
        outputMode={outputMode}
        onBack={() => {
          setMode(null);
          setOutputMode(null);
        }}
      />
    );
  }

  if (mode && !outputMode) {
    return (
      <List searchBarPlaceholder="Choisissez le format de sortie...">
        <List.Item
          title="Découpe par concept"
          subtitle="Extraction Zettelkasten avec concepts, définitions et MOC"
          icon={Icon.Tag}
          actions={
            <ActionPanel>
              <Action
                title="Sélectionner"
                icon={Icon.CheckCircle}
                onAction={() => setOutputMode("concept")}
              />
              <Action
                title="Retour"
                icon={Icon.ArrowLeft}
                onAction={() => setMode(null)}
              />
            </ActionPanel>
          }
        />
        <List.Item
          title="Traduction Readwise"
          subtitle="Traduit en français et envoie à Readwise Reader"
          icon={Icon.Globe}
          actions={
            <ActionPanel>
              <Action
                title="Sélectionner"
                icon={Icon.CheckCircle}
                onAction={() => setOutputMode("article")}
              />
              <Action
                title="Retour"
                icon={Icon.ArrowLeft}
                onAction={() => setMode(null)}
              />
            </ActionPanel>
          }
        />
        <List.Item
          title="Les deux"
          subtitle="Concepts (Obsidian) + Traduction (Readwise)"
          icon={Icon.Layers}
          actions={
            <ActionPanel>
              <Action
                title="Sélectionner"
                icon={Icon.CheckCircle}
                onAction={() => setOutputMode("both")}
              />
              <Action
                title="Retour"
                icon={Icon.ArrowLeft}
                onAction={() => setMode(null)}
              />
            </ActionPanel>
          }
        />
      </List>
    );
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
      <List.Item
        title="Article"
        subtitle="Traiter un article web (URL ou Readwise inbox)"
        icon={Icon.Book}
        actions={
          <ActionPanel>
            <Action
              title="Sélectionner"
              icon={Icon.CheckCircle}
              onAction={() => setMode("article")}
            />
          </ActionPanel>
        }
      />
    </List>
  );
}
