#!/bin/bash
# Transcription script that runs detached from Raycast
# Usage: transcribe-local.sh <file_path> <job_id> <output_mode>

# Setup PATH for homebrew and local binaries
export PATH="/opt/homebrew/bin:$HOME/.local/bin:/usr/local/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load .env if exists
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -f "$ENV_FILE" ]]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

FILE_PATH="$1"
JOB_ID="$2"
OUTPUT_MODE="$3"
JOBS_FILE="$HOME/.cache/raycast-transcriber/jobs.json"
CACHE_DIR="$HOME/.cache/raycast-transcriber"
WHISPER="$HOME/.local/bin/whisper"
CLAUDE="/opt/homebrew/bin/claude"
PROCESS_SCRIPT="$SCRIPT_DIR/process-transcript.py"

# Obsidian paths (configurable via .env)
OBSIDIAN_VAULT="${OBSIDIAN_VAULT:-$HOME/Documents/Obsidian}"
OBSIDIAN_INBOX="${OBSIDIAN_INBOX:-$OBSIDIAN_VAULT/0 INBOX}"

# Ensure cache dir exists
mkdir -p "$CACHE_DIR"

# Function to update job status
update_status() {
    local status="$1"
    local error="$2"

    if [ -f "$JOBS_FILE" ]; then
        if [ -n "$error" ]; then
            jq --arg id "$JOB_ID" --arg status "$status" --arg error "$error" --arg endTime "$(date +%s)000" \
                '(.[] | select(.id == $id)) |= . + {status: $status, error: $error, endTime: ($endTime | tonumber)}' \
                "$JOBS_FILE" > "$JOBS_FILE.tmp" && mv "$JOBS_FILE.tmp" "$JOBS_FILE"
        elif [ "$status" = "completed" ] || [ "$status" = "failed" ]; then
            jq --arg id "$JOB_ID" --arg status "$status" --arg endTime "$(date +%s)000" \
                '(.[] | select(.id == $id)) |= . + {status: $status, endTime: ($endTime | tonumber)}' \
                "$JOBS_FILE" > "$JOBS_FILE.tmp" && mv "$JOBS_FILE.tmp" "$JOBS_FILE"
        else
            jq --arg id "$JOB_ID" --arg status "$status" \
                '(.[] | select(.id == $id)).status = $status' \
                "$JOBS_FILE" > "$JOBS_FILE.tmp" && mv "$JOBS_FILE.tmp" "$JOBS_FILE"
        fi
    fi
}

# Function to send macOS notification
notify() {
    local title="$1"
    local message="$2"
    osascript -e "display notification \"$message\" with title \"$title\" sound name \"Glass\""
}

# Get filename without extension
FILENAME=$(basename "$FILE_PATH")
BASENAME="${FILENAME%.*}"

# Step 1: Transcribe
update_status "transcribing"
TRANSCRIPT_FILE="$CACHE_DIR/$BASENAME.txt"

if ! "$WHISPER" "$FILE_PATH" --model medium --language fr --output_format txt --output_dir "$CACHE_DIR" 2>"$CACHE_DIR/whisper-error.log"; then
    ERROR=$(cat "$CACHE_DIR/whisper-error.log" | tail -1)
    update_status "failed" "$ERROR"
    notify "Transcription échouée ❌" "$FILENAME"
    exit 1
fi

TRANSCRIPTION=$(cat "$TRANSCRIPT_FILE")

# Step 2: Generate summary with Claude
update_status "summarizing"
ANALYSIS=$(cat "$TRANSCRIPT_FILE" | python3 "$PROCESS_SCRIPT" "$OUTPUT_MODE" 2>"$CACHE_DIR/claude-error.log")
if [ -z "$ANALYSIS" ]; then
    ERROR_MSG=$(cat "$CACHE_DIR/claude-error.log" 2>/dev/null | tail -3)
    ANALYSIS="Analyse non disponible. Erreur: $ERROR_MSG"
fi

# Step 3: Save based on output mode
update_status "saving"

# Function to save to Readwise (article mode)
save_to_readwise() {
    local analysis_text="$1"

    # Extract tags from first line (using parameter expansion for bash/zsh compatibility)
    TAGS_LINE=$(echo "$analysis_text" | head -n1)
    if [[ "$TAGS_LINE" == TAGS:* ]]; then
        CLAUDE_TAGS="${TAGS_LINE#TAGS: }"
        # Remove tags line from article content
        ARTICLE_CONTENT=$(echo "$analysis_text" | tail -n +2)
    else
        CLAUDE_TAGS=""
        ARTICLE_CONTENT="$analysis_text"
    fi

    # Combine tags: transcription + Claude suggestions
    if [ -n "$CLAUDE_TAGS" ]; then
        ALL_TAGS="transcription,$CLAUDE_TAGS"
    else
        ALL_TAGS="transcription"
    fi

    # Convert markdown to simple HTML
    HTML_FILE="$CACHE_DIR/$BASENAME.html"
    {
        echo "<html><body>"
        echo "$ARTICLE_CONTENT" | sed 's/^### \(.*\)/<h3>\1<\/h3>/'
        echo "</body></html>"
    } > "$HTML_FILE"

    # Build URL (Readwise requires a valid URL format)
    SAFE_BASENAME=$(echo "$BASENAME" | sed 's/ /-/g' | tr '[:upper:]' '[:lower:]')
    ARTICLE_URL="https://local.transcription/${SAFE_BASENAME}"

    # Send to Readwise
    "$SCRIPT_DIR/send-to-readwise.sh" "$ARTICLE_URL" "$BASENAME" "$HTML_FILE" "$ALL_TAGS"
    local result=$?

    # Cleanup
    rm -f "$HTML_FILE"

    return $result
}

# Function to save to Obsidian (concept mode)
save_to_obsidian() {
    local analysis_text="$1"
    local mode_label="$2"

    DATE=$(date +%Y-%m-%d)
    OUTPUT_FILE="$OBSIDIAN_INBOX/$BASENAME - Transcription.md"

    cat > "$OUTPUT_FILE" << EOF
---
source: dwhelper
date: $DATE
type: transcription
mode: $mode_label
---

# $BASENAME

## Concepts

$analysis_text

## Transcription complète

$TRANSCRIPTION
EOF
}

if [ "$OUTPUT_MODE" = "article" ]; then
    if save_to_readwise "$ANALYSIS"; then
        update_status "completed"
        notify "Sauvegardé dans Reader ✅" "$FILENAME"
    else
        update_status "failed" "Échec envoi Readwise"
        notify "Échec envoi Reader ❌" "$FILENAME"
        exit 1
    fi
elif [ "$OUTPUT_MODE" = "both" ]; then
    # Generate concept analysis for Obsidian
    CONCEPT_ANALYSIS=$(cat "$TRANSCRIPT_FILE" | python3 "$PROCESS_SCRIPT" "concept" 2>"$CACHE_DIR/claude-concept-error.log")
    if [ -z "$CONCEPT_ANALYSIS" ]; then
        CONCEPT_ANALYSIS="$ANALYSIS"  # Fallback to original analysis
    fi

    # Generate article analysis for Readwise
    ARTICLE_ANALYSIS=$(cat "$TRANSCRIPT_FILE" | python3 "$PROCESS_SCRIPT" "article" 2>"$CACHE_DIR/claude-article-error.log")
    if [ -z "$ARTICLE_ANALYSIS" ]; then
        ARTICLE_ANALYSIS="$ANALYSIS"  # Fallback to original analysis
    fi

    # Save both
    save_to_obsidian "$CONCEPT_ANALYSIS" "both"

    if save_to_readwise "$ARTICLE_ANALYSIS"; then
        update_status "completed"
        notify "Sauvegardé partout ✅" "$FILENAME → Obsidian + Reader"
    else
        update_status "completed"  # Obsidian worked, so partial success
        notify "Obsidian ✅ Reader ❌" "$FILENAME"
    fi
else
    # Concept mode: save to Obsidian (existing behavior)
    save_to_obsidian "$ANALYSIS" "$OUTPUT_MODE"
    update_status "completed"
    notify "Transcription terminée ✅" "$FILENAME sauvegardé dans Obsidian"
fi

# Cleanup
rm -f "$TRANSCRIPT_FILE" "$CACHE_DIR/whisper-error.log" "$CACHE_DIR/claude-error.log"

# Notification only - don't open anything to avoid Finder/Warp popups
