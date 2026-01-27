# Mediascribe

Extension Raycast pour transformer des vidéos, podcasts et articles en notes structurées.

![Raycast Extension](https://img.shields.io/badge/Raycast-Extension-red?logo=raycast)
![License MIT](https://img.shields.io/badge/License-MIT-blue)

Mediascribe automatise le flux de travail : **transcription → analyse par Claude → export vers Obsidian ou Readwise Reader**.

## Fonctionnalités

### Sources supportées

| Source | Description |
|--------|-------------|
| **YouTube** | Coller une URL, l'audio est téléchargé et transcrit automatiquement |
| **Fichiers locaux** | Parcourir les fichiers audio/vidéo dans le dossier média configuré |
| **Articles web** | Extraire le contenu d'une URL ou depuis Readwise Reader |

### Modes de sortie

| Mode | Description |
|------|-------------|
| **Découpe par concept** | Extraction Zettelkasten : chaque concept devient une note atomique dans Obsidian |
| **Traduction Readwise** | Résumé traduit en français, envoyé vers Readwise Reader |
| **Les deux** | Combine les deux exports |

## Prérequis

### Outils externes

```bash
# Whisper - transcription audio
pipx install openai-whisper

# yt-dlp - téléchargement YouTube
brew install yt-dlp

# lynx - extraction de texte HTML
brew install lynx

# jq - parsing JSON
brew install jq
```

### Claude CLI

L'extension utilise [Claude Code](https://claude.ai/code) pour l'analyse. Le binaire `claude` doit être accessible dans `/opt/homebrew/bin/claude`.

## Installation

```bash
npm install
npm run build
```

Dans Raycast : **Import Extension** → sélectionner ce dossier.

## Configuration

Copiez le fichier d'exemple et ajustez les valeurs :

```bash
cp .env.example .env
```

| Variable | Description | Défaut |
|----------|-------------|--------|
| `READWISE_TOKEN` | Token API Readwise Reader | - |
| `MEDIA_DIR` | Dossier des fichiers audio/vidéo locaux | `~/dwhelper` |
| `OBSIDIAN_VAULT` | Chemin vers le vault Obsidian | `~/Documents/Obsidian` |
| `OBSIDIAN_INBOX` | Dossier inbox dans Obsidian | `$OBSIDIAN_VAULT/0 INBOX` |

Le token Readwise peut aussi être configuré dans les préférences Raycast de l'extension.

## Utilisation

### Commande : Transcribe Media

1. Ouvrir Raycast et lancer **Transcribe Media**
2. Choisir la source :
   - **YouTube URL** → Coller l'URL de la vidéo
   - **Fichier Local** → Sélectionner un fichier dans le dossier média (`MEDIA_DIR`)
   - **Article** → Entrer une URL ou choisir depuis Readwise
3. Sélectionner le mode de sortie
4. La transcription démarre en arrière-plan

### Commande : Transcriptions en cours

Affiche l'état des jobs :
- **En attente** → Dans la file
- **Transcription** → Whisper en cours
- **Analyse** → Claude traite le contenu
- **Sauvegarde** → Export vers Obsidian/Readwise
- **Terminé** → Notes disponibles dans la destination

## Développement

```bash
npm run dev       # Mode développement avec hot reload
npm run lint      # Vérifier le code
npm run fix-lint  # Corriger automatiquement
```

## Licence

MIT
