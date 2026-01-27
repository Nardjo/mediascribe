import { ActionPanel, Action, List, Icon } from "@raycast/api";
import { useState } from "react";
import { OutputMode } from "./types";
import { ArticleUrl } from "./article-url";
import { ReadwiseArticles } from "./readwise-articles";

type ArticleSource = "url" | "readwise";

export function ArticleTranscribe({
  outputMode,
  onBack,
}: {
  outputMode: OutputMode;
  onBack: () => void;
}) {
  const [source, setSource] = useState<ArticleSource | null>(null);

  if (source === "url") {
    return (
      <ArticleUrl outputMode={outputMode} onBack={() => setSource(null)} />
    );
  }

  if (source === "readwise") {
    return (
      <ReadwiseArticles
        outputMode={outputMode}
        onBack={() => setSource(null)}
      />
    );
  }

  return (
    <List searchBarPlaceholder="Choisissez la source de l'article...">
      <List.Item
        title="Via URL"
        subtitle="Coller un lien vers un article web"
        icon={Icon.Link}
        actions={
          <ActionPanel>
            <Action
              title="Sélectionner"
              icon={Icon.CheckCircle}
              onAction={() => setSource("url")}
            />
            <Action
              title="Retour"
              icon={Icon.ArrowLeft}
              shortcut={{ modifiers: ["cmd"], key: "b" }}
              onAction={onBack}
            />
          </ActionPanel>
        }
      />
      <List.Item
        title="Depuis Readwise"
        subtitle="Sélectionner des articles de votre inbox Reader"
        icon={Icon.Book}
        actions={
          <ActionPanel>
            <Action
              title="Sélectionner"
              icon={Icon.CheckCircle}
              onAction={() => setSource("readwise")}
            />
            <Action
              title="Retour"
              icon={Icon.ArrowLeft}
              shortcut={{ modifiers: ["cmd"], key: "b" }}
              onAction={onBack}
            />
          </ActionPanel>
        }
      />
    </List>
  );
}
