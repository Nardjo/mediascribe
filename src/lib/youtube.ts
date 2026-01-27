import { execa } from "execa";
import { join } from "path";
import { homedir } from "os";
import { YouTubeResult } from "../types";

export function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/,
    /^[\w-]{11}$/,
  ];
  return patterns.some((pattern) => pattern.test(url));
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:v=|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export async function transcribeYouTube(url: string): Promise<string> {
  const scriptPath = join(
    homedir(),
    "Developer/PERSO/nexus/raycast-transcriber/scripts/yt-transcribe",
  );

  const { stdout } = await execa(scriptPath, [url]);

  return stdout;
}
