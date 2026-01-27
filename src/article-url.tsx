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
import { getObsidianInboxPath } from "./lib/obsidian";
import { createJob } from "./lib/jobs";
import { OutputMode } from "./types";

const SCRIPT_PATH = join(
  homedir(),
  "Developer/PERSO/nexus/raycast-transcriber/scripts/process-article.sh",
);

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function ArticleUrl({
  outputMode,
  onBack,
}: {
  outputMode: OutputMode;
  onBack: () => void;
}) {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState<string | undefined>();

  const handleSubmit = async () => {
    if (!isValidUrl(url)) {
      setUrlError("URL invalide");
      return;
    }

    // Create job for tracking
    const hostname = new URL(url).hostname;
    const job = await createJob(`Article: ${hostname}`, url, "article");

    // Launch script with nohup to survive Raycast closing
    const escapedUrl = url.replace(/'/g, "'\\''");
    const cmd = `nohup "${SCRIPT_PATH}" '${escapedUrl}' '${job.id}' '${outputMode}' 'url' > /dev/null 2>&1 &`;
    exec(cmd);

    // Show HUD and close Raycast immediately
    await showHUD(`📄 Traitement de l'article lancé`);
    await closeMainWindow();
    await popToRoot();
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Traiter l'article"
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
        title="URL de l'article"
        placeholder="https://example.com/article"
        value={url}
        onChange={(value) => {
          setUrl(value);
          if (urlError) setUrlError(undefined);
        }}
        error={urlError}
      />
      <Form.Description text="Collez l'URL d'un article web. Le contenu sera extrait et traité avec Claude." />
    </Form>
  );
}
