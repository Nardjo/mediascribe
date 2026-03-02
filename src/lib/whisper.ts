import { execa } from "execa";
import { homedir } from "os";
import { join } from "path";
import { mkdir } from "fs/promises";

const WHISPER_PATH = join(homedir(), ".local", "bin", "whisper");
const WHISPER_MODEL = "medium";

export async function transcribe(filePath: string): Promise<string> {
  const outputDir = join(homedir(), ".cache", "mediascribe");

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  const { stdout } = await execa(
    WHISPER_PATH,
    [
      filePath,
      "--model",
      WHISPER_MODEL,
      "--language",
      "fr",
      "--output_format",
      "txt",
      "--output_dir",
      outputDir,
    ],
    {
      env: {
        ...process.env,
        PATH: `${process.env.PATH}:${join(homedir(), ".local", "bin")}:/opt/homebrew/bin:/usr/local/bin`,
      },
    },
  );

  // Whisper outputs to a .txt file with the same base name
  const baseName =
    filePath
      .split("/")
      .pop()
      ?.replace(/\.[^/.]+$/, "") || "output";
  const txtPath = join(outputDir, `${baseName}.txt`);

  // Read the output file
  const fs = await import("fs/promises");
  const transcription = await fs.readFile(txtPath, "utf-8");

  // Clean up the temp file
  await fs.unlink(txtPath).catch(() => {});

  return transcription.trim();
}

export function getWhisperPath(): string {
  return WHISPER_PATH;
}
