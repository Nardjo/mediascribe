import {
  ActionPanel,
  Action,
  List,
  showToast,
  showHUD,
  Toast,
  Icon,
  open,
  popToRoot,
  closeMainWindow,
  getPreferenceValues,
} from "@raycast/api";
import { exec } from "child_process";
import { useState, useEffect } from "react";
import { homedir } from "os";
import { join } from "path";
import { readFile } from "fs/promises";
import { getObsidianInboxPath } from "./lib/obsidian";
import { createJob } from "./lib/jobs";
import { OutputMode, ReadwiseArticle } from "./types";

const SCRIPT_DIR = join(__dirname, "..", "scripts");
const SCRIPT_PATH = join(SCRIPT_DIR, "process-article.sh");

// Fallback paths for Readwise token
const ENV_FILE_PATH = join(__dirname, "..", ".env");
const MCP_CONFIG_PATH = join(homedir(), ".claude", "mcp.json");

interface Preferences {
  readwiseToken?: string;
}

async function getReadwiseToken(): Promise<string | null> {
  // 1. First try Raycast preferences
  const prefs = getPreferenceValues<Preferences>();
  if (prefs.readwiseToken) {
    return prefs.readwiseToken;
  }

  // 2. Try environment variable
  if (process.env.READWISE_TOKEN) {
    return process.env.READWISE_TOKEN;
  }

  // 3. Try .env file in project root
  try {
    const envContent = await readFile(ENV_FILE_PATH, "utf-8");
    const match = envContent.match(/READWISE_TOKEN=(.+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch {
    // .env file not found, continue
  }

  // 4. Fall back to mcp.json
  try {
    const config = await readFile(MCP_CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(config);
    return parsed.mcpServers?.["readwise-reader"]?.env?.READWISE_TOKEN || null;
  } catch {
    return null;
  }
}

async function fetchInboxArticles(token: string): Promise<ReadwiseArticle[]> {
  const response = await fetch(
    "https://readwise.io/api/v3/list/?location=new",
    {
      headers: {
        Authorization: `Token ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Readwise API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results.map((item: Record<string, unknown>) => ({
    id: item.id as string,
    title: item.title as string,
    url: (item.source_url as string) || (item.url as string),
    author: item.author as string | undefined,
    source: item.source as string | undefined,
    summary: item.summary as string | undefined,
    created_at: item.created_at as string,
    reading_progress: (item.reading_progress as number) || 0,
  }));
}

async function archiveArticle(
  token: string,
  articleId: string,
): Promise<boolean> {
  const response = await fetch(
    `https://readwise.io/api/v3/update/${articleId}/`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ location: "archive" }),
    },
  );

  return response.ok;
}

export function ReadwiseArticles({
  outputMode,
  onBack,
}: {
  outputMode: OutputMode;
  onBack: () => void;
}) {
  const [articles, setArticles] = useState<ReadwiseArticle[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const readwiseToken = await getReadwiseToken();
      if (!readwiseToken) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Token Readwise manquant",
          message:
            "Configurez le token dans les préférences ou ~/.claude/mcp.json",
        });
        setIsLoading(false);
        return;
      }

      setToken(readwiseToken);

      try {
        const items = await fetchInboxArticles(readwiseToken);
        setArticles(items);
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Erreur API Readwise",
          message: String(error),
        });
      }

      setIsLoading(false);
    }

    load();
  }, []);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleProcessSelected = async () => {
    if (selectedIds.size === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Aucun article sélectionné",
      });
      return;
    }

    if (!token) return;

    const selectedArticles = articles.filter((a) => selectedIds.has(a.id));

    // Create jobs and launch processing for each article
    for (const article of selectedArticles) {
      const job = await createJob(
        `Readwise: ${article.title}`,
        article.url,
        "article",
      );

      // Launch script with nohup
      const escapedUrl = article.url.replace(/'/g, "'\\''");
      const escapedId = article.id;
      const cmd = `nohup "${SCRIPT_PATH}" '${escapedUrl}' '${job.id}' '${outputMode}' 'readwise' '${escapedId}' > /dev/null 2>&1 &`;
      exec(cmd);
    }

    await showHUD(
      `📚 Traitement de ${selectedArticles.length} article(s) lancé`,
    );
    await closeMainWindow();
    await popToRoot();
  };

  const handleProcessSingle = async (article: ReadwiseArticle) => {
    if (!token) return;

    const job = await createJob(
      `Readwise: ${article.title}`,
      article.url,
      "article",
    );

    const escapedUrl = article.url.replace(/'/g, "'\\''");
    const escapedId = article.id;
    const cmd = `nohup "${SCRIPT_PATH}" '${escapedUrl}' '${job.id}' '${outputMode}' 'readwise' '${escapedId}' > /dev/null 2>&1 &`;
    exec(cmd);

    await showHUD(`📄 Traitement de l'article lancé`);
    await closeMainWindow();
    await popToRoot();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Rechercher un article...">
      {selectedIds.size > 0 && (
        <List.Item
          title={`Traiter ${selectedIds.size} article(s) sélectionné(s)`}
          icon={Icon.Play}
          actions={
            <ActionPanel>
              <Action
                title="Traiter la sélection"
                icon={Icon.Play}
                onAction={handleProcessSelected}
              />
              <Action
                title="Tout désélectionner"
                icon={Icon.XMarkCircle}
                onAction={() => setSelectedIds(new Set())}
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
      )}

      {articles.length === 0 && !isLoading ? (
        <List.EmptyView
          title="Inbox vide"
          description="Aucun article dans votre inbox Readwise"
          icon={Icon.Book}
        />
      ) : (
        articles.map((article) => (
          <List.Item
            key={article.id}
            title={article.title}
            subtitle={article.author || article.source}
            icon={selectedIds.has(article.id) ? Icon.CheckCircle : Icon.Circle}
            accessories={[{ text: formatDate(article.created_at) }]}
            actions={
              <ActionPanel>
                <Action
                  title={
                    selectedIds.has(article.id)
                      ? "Désélectionner"
                      : "Sélectionner"
                  }
                  icon={
                    selectedIds.has(article.id) ? Icon.Circle : Icon.CheckCircle
                  }
                  onAction={() => toggleSelection(article.id)}
                />
                <Action
                  title="Traiter cet article"
                  icon={Icon.Play}
                  shortcut={{ modifiers: ["cmd"], key: "return" }}
                  onAction={() => handleProcessSingle(article)}
                />
                {selectedIds.size > 0 && (
                  <Action
                    title={`Traiter ${selectedIds.size} sélectionné(s)`}
                    icon={Icon.Play}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "return" }}
                    onAction={handleProcessSelected}
                  />
                )}
                <Action
                  title="Ouvrir dans Reader"
                  icon={Icon.Globe}
                  shortcut={{ modifiers: ["cmd"], key: "o" }}
                  onAction={() => open(article.url)}
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
          />
        ))
      )}
    </List>
  );
}
