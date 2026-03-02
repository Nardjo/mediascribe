import { executeAICommand } from "./ai-provider.js";

const SUMMARY_PROMPT = `Tu es un assistant qui résume des transcriptions de vidéos/podcasts.

Résume cette transcription en français avec:
- Un titre court et accrocheur (1 ligne)
- 5-10 bullet points des points clés
- Sois concis et va à l'essentiel

Format ta réponse en markdown.`;

export async function generateSummary(transcription: string): Promise<string> {
  const fullPrompt = `${SUMMARY_PROMPT}\n\nTranscription:\n${transcription}`;
  return executeAICommand(fullPrompt);
}
