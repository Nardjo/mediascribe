#!/usr/bin/env python3
"""
Process transcript with Claude CLI using different output modes.

Usage: process-transcript.py <mode>
Reads transcript from stdin, outputs to stdout.
"""

import sys
import subprocess
import json

CONCEPT_PROMPT = """Tu es un expert en analyse de contenu vidéo et en méthode Zettelkasten pour Obsidian.
Ta mission est d'analyser des transcriptions YouTube et d'en extraire les informations clés.

TA MISSION : Extraire les concepts, définitions, idées clés et points importants de la transcription fournie.

RÈGLES DE FORMATAGE :
- Chaque élément commence par ### (titre en H3, PAS de H2)
- Utilise EXACTEMENT ce format pour chaque élément :

### [Nom du concept/idée/définition]
**Type:** [Concept | Définition | Idée clé | Point important]

[Explication brève mais complète]

**MOC suggérés:** `[[MOC X]]`, `[[MOC Y]]`, `[[MOC Z]]`

---
[séparateur entre chaque élément]

- Sépare chaque élément par ---
- Propose 2-3 MOC pertinents pour chaque élément (thématiques larges)
- Les thématiques possibles : Philosophie, Psychologie, Économie, Sociologie, Science, Technologie, Auteurs spécifiques, Concepts métiers, Stratégie, Productivité, Spiritualité, Art, etc.
- Sois exhaustif mais concis (2-5 phrases par élément)
- Extrais TOUS les concepts, définitions, idées clés et points importants
- Ordonne logiquement (par thème ou chronologiquement)

TYPE D'ÉLÉMENTS À EXTRAIRE :
1. Concepts nouveaux ou complexes
2. Définitions de termes clés
3. Idées principales de la vidéo
4. Points importants ou mémorables
5. Méthodologies ou frameworks présentés
6. Controverses ou débats mentionnés
7. Statistiques ou données chiffrées
8. Citations notables
9. Ressources ou livres recommandés
10. Actions ou conseils pratiques

FORMAT DE SORTIE :
Ne mets PAS de titre "Analyse" au début.
Commence directement par le premier ### .
Sépare chaque élément par ---.

Langue de réponse : même langue que la transcription (français ou anglais)."""

ARTICLE_PROMPT = """Tu es un expert en rédaction. Transforme cette transcription en article structuré.

RÈGLES STRICTES:
- Produis DIRECTEMENT l'article, sans commentaire, sans question, sans demander confirmation
- PREMIÈRE LIGNE: TAGS: tag1, tag2, tag3 (2-3 tags pertinents au sujet de la transcription)
- Si pas en français, traduis en français
- Sections avec titres H3 (###) - PAS de H2
- Corrige les erreurs de transcription
- Paragraphes courts et aérés
- Listes à puces si pertinent

FORMAT (commence par les tags puis le titre):
TAGS: tag1, tag2, tag3

### [Titre déduit du contenu]

[Introduction]

### [Section 1]
[Contenu]

### Points clés
- [Point 1]
- [Point 2]

IMPORTANT: Ne pose AUCUNE question. Produis l'article immédiatement."""

def main():
    if len(sys.argv) < 2:
        print("Usage: process-transcript.py <mode>", file=sys.stderr)
        sys.exit(1)

    mode = sys.argv[1]

    # Read transcript from stdin
    transcript = sys.stdin.read().strip()

    if not transcript:
        print("Error: No transcript provided", file=sys.stderr)
        sys.exit(1)

    # Select prompt based on mode
    if mode == "concept":
        prompt = CONCEPT_PROMPT
    elif mode == "article":
        prompt = ARTICLE_PROMPT
    else:
        print(f"Error: Invalid mode '{mode}'. Use 'concept' or 'article'", file=sys.stderr)
        sys.exit(1)

    # Call Claude CLI with combined prompt (system + transcript)
    try:
        full_prompt = f"{prompt}\n\n---\n\nTRANSCRIPTION À ANALYSER:\n\n{transcript}"
        result = subprocess.run(
            ["claude", "-p", full_prompt, "--output-format", "json", "--permission-mode", "default", "--dangerously-skip-permissions"],
            capture_output=True,
            text=True,
            timeout=300
        )

        if result.returncode == 0:
            try:
                response = json.loads(result.stdout)
                # Claude CLI returns array of events, find the result entry
                result_entry = next((item for item in reversed(response) if item.get("type") == "result"), None)
                if result_entry:
                    output = result_entry.get("result", "")
                    if output:
                        print(output)
                    else:
                        print("Error: Empty result from Claude CLI", file=sys.stderr)
                        sys.exit(1)
                else:
                    print("Error: No result entry in Claude CLI response", file=sys.stderr)
                    sys.exit(1)
            except json.JSONDecodeError as e:
                print(f"Error: Failed to parse Claude CLI response: {e}", file=sys.stderr)
                print(f"Raw output: {result.stdout[:500]}", file=sys.stderr)
                sys.exit(1)
        else:
            print(f"Error: Claude CLI failed: {result.stderr}", file=sys.stderr)
            sys.exit(1)

    except subprocess.TimeoutExpired:
        print("Error: Claude CLI timed out", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
