import { homedir } from "os";
import { join } from "path";
import { writeFile, readFile } from "fs/promises";

// Load from environment or .env file, with defaults
const ENV_FILE = join(__dirname, "..", "..", ".env");

async function loadEnvVar(name: string, defaultValue: string): Promise<string> {
  if (process.env[name]) {
    return process.env[name]!;
  }
  try {
    const content = await readFile(ENV_FILE, "utf-8");
    const match = content.match(new RegExp(`^${name}=(.+)$`, "m"));
    if (match) {
      return match[1].trim().replace(/^~/, homedir());
    }
  } catch {
    // .env not found
  }
  return defaultValue;
}

// Sync version for getObsidianInboxPath
function getEnvVarSync(name: string, defaultValue: string): string {
  if (process.env[name]) {
    return process.env[name]!.replace(/^~/, homedir());
  }
  return defaultValue;
}

const DEFAULT_OBSIDIAN_INBOX = join(homedir(), "Documents", "Obsidian", "0 INBOX");
const OBSIDIAN_INBOX = getEnvVarSync("OBSIDIAN_INBOX", DEFAULT_OBSIDIAN_INBOX);

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export async function saveToObsidian(
  fileName: string,
  summary: string,
  transcription: string,
): Promise<string> {
  const date = new Date();
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  const sanitizedName = sanitizeFilename(baseName);
  const obsidianFileName = `${formatDate(date)} - ${sanitizedName}.md`;
  const filePath = join(OBSIDIAN_INBOX, obsidianFileName);

  const content = `---
source: dwhelper
date: ${formatDate(date)}
type: transcription
original_file: ${fileName}
---

${summary}

---

## Transcription complète

${transcription}
`;

  await writeFile(filePath, content, "utf-8");

  return filePath;
}

export function getObsidianInboxPath(): string {
  return OBSIDIAN_INBOX;
}
