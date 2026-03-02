import { execa } from "execa";

type AIProvider = "claude";

interface ProviderConfig {
  command: string;
  args: string[];
  timeout: number;
}

const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  claude: {
    command: "claude",
    args: ["--print"],
    timeout: 120000,
  },
};

async function detectAvailableProvider(): Promise<AIProvider | null> {
  try {
    await execa("claude", ["--version"], { timeout: 5000 });
    return "claude";
  } catch {
    return null;
  }
}

let cachedProvider: AIProvider | null | undefined;

async function getProvider(): Promise<AIProvider> {
  if (cachedProvider === undefined) {
    cachedProvider = await detectAvailableProvider();
  }

  if (cachedProvider === null) {
    throw new Error(
      "Claude Code n'est pas disponible. Veuillez l'installer : npm install -g @anthropic-ai/claude-code"
    );
  }

  return cachedProvider;
}

export async function executeAICommand(prompt: string): Promise<string> {
  const provider = await getProvider();
  const config = PROVIDER_CONFIGS[provider];

  const { stdout } = await execa(config.command, [...config.args, prompt], {
    timeout: config.timeout,
  });

  return stdout.trim();
}

export async function isProviderAvailable(): Promise<boolean> {
  const provider = await detectAvailableProvider();
  return provider !== null;
}

export async function getAvailableProvider(): Promise<AIProvider | null> {
  return detectAvailableProvider();
}
