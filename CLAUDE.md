# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Project Overview

**Mediascribe** is a Raycast extension for transcribing audio/video content and processing articles. It integrates with Claude Code CLI for AI-powered summaries, Whisper for transcription, Obsidian for note storage, and Readwise Reader for article management.

## Commands

```bash
# Development
npm install          # Install dependencies
npm run dev          # Development mode with hot reload
npm run build        # Build extension (uses ray build --skip-types)

# Linting
npm run lint         # Check for linting issues
npm run fix-lint     # Auto-fix linting issues
```

## Architecture

### Three-Tier Design

1. **React UI** (`src/*.tsx`) - Raycast extension commands and views
2. **TypeScript Libraries** (`src/lib/`) - Business logic and API wrappers
3. **Shell/Python Scripts** (`scripts/`) - External tool orchestration

### Processing Flow

```
User Input → Raycast UI → Job Created → Shell Script (async)
                                            ↓
                                  Whisper/yt-dlp/lynx
                                            ↓
                                   Claude Code CLI → Summary
                                            ↓
                               Obsidian/Readwise → Output
```

### Key Files

| File | Purpose |
|------|---------|
| `src/transcribe.tsx` | Main entry point - mode selection |
| `src/lib/jobs.ts` | Job persistence (`~/.cache/raycast-transcriber/jobs.json`) |
| `src/lib/ai-provider.ts` | AI provider (Claude Code) |
| `src/lib/claude.ts` | AI wrapper for summaries |
| `src/lib/whisper.ts` | Whisper transcription wrapper |
| `scripts/transcribe-*.sh` | Transcription orchestrators |
| `scripts/process-*.py` | Python processing scripts |

### Output Modes

- **Découpe par concept**: Zettelkasten-style extraction → Obsidian vault
- **Traduction Readwise**: French translation → Readwise Reader
- **Les deux**: Both outputs

## External Dependencies

These must be installed separately:
- `~/.local/bin/whisper` - OpenAI Whisper
- `claude` - Claude Code CLI
- `yt-dlp` - YouTube video downloading
- `lynx` - HTML text extraction
- `jq` - JSON parsing

## Configuration

Environment variables (`.env` or Raycast preferences):
- `READWISE_TOKEN` - Readwise Reader API token
- `MEDIA_DIR` - Local media files directory (default: `~/dwhelper`)
- `OBSIDIAN_VAULT` - Vault path (default: `~/Documents/Obsidian`)
- `OBSIDIAN_INBOX` - Inbox folder (default: `$OBSIDIAN_VAULT/0 INBOX`)
