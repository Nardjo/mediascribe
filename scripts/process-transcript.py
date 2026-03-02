#!/usr/bin/env python3
"""
Clean transcript with Claude Code CLI.

Usage: process-transcript.py
Reads transcript from stdin, outputs cleaned transcript to stdout.
"""

import sys
import subprocess
import json

TRANSCRIPT_PROMPT = """Tu es un expert en nettoyage de transcriptions audio/vidéo.

TA MISSION : Nettoyer et restituer la transcription de manière intégrale et fidèle.

RÈGLES STRICTES:
- Produis DIRECTEMENT la transcription nettoyée, sans commentaire, sans question
- Si la langue source N'EST PAS le français, traduis INTÉGRALEMENT en français
- Corrige les erreurs évidentes de speech-to-text (mots mal reconnus, phrases cassées)
- Garde le contenu INTÉGRAL : ne résume PAS, ne coupe PAS, ne restructure PAS
- Organise en paragraphes naturels pour la lisibilité
- Pas de titres, pas de sections, pas de listes : juste du texte fluide en paragraphes
- Conserve le ton et le style du locuteur original

FORMAT DE SORTIE:
Un texte fluide organisé en paragraphes, fidèle au contenu original.

IMPORTANT: Ne pose AUCUNE question. Produis la transcription nettoyée immédiatement."""


def process_with_claude(transcript):
    full_prompt = f"{TRANSCRIPT_PROMPT}\n\n---\n\nTRANSCRIPTION À ANALYSER:\n\n{transcript}"
    result = subprocess.run(
        ["claude", "-p", full_prompt, "--output-format", "json", "--permission-mode", "default", "--dangerously-skip-permissions"],
        capture_output=True,
        text=True,
        timeout=300
    )

    if result.returncode != 0:
        raise RuntimeError(f"Claude CLI failed: {result.stderr}")

    response = json.loads(result.stdout)
    result_entry = next((item for item in reversed(response) if item.get("type") == "result"), None)
    if not result_entry:
        raise RuntimeError("No result entry in Claude CLI response")

    output = result_entry.get("result", "")
    if not output:
        raise RuntimeError("Empty result from Claude CLI")

    return output


def main():
    transcript = sys.stdin.read().strip()

    if not transcript:
        print("Error: No transcript provided", file=sys.stderr)
        sys.exit(1)

    try:
        output = process_with_claude(transcript)
        print(output)
    except subprocess.TimeoutExpired:
        print("Error: Claude CLI timed out", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Failed to parse Claude CLI response: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
