#!/bin/bash
# Transcription script that runs detached from Raycast
# Usage: transcribe-local.sh <file_path> <job_id>

# Setup PATH for homebrew and local binaries
export PATH="/opt/homebrew/bin:$HOME/.local/bin:/usr/local/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load .env if exists
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -f "$ENV_FILE" ]]; then
    while IFS='=' read -r key value; do
        [[ -z "$key" || "$key" =~ ^# ]] && continue
        value="${value/#\~/$HOME}"
        export "$key=$value"
    done < "$ENV_FILE"
fi

FILE_PATH="$1"
JOB_ID="$2"
JOBS_FILE="$HOME/.cache/mediascribe/jobs.json"
CACHE_DIR="$HOME/.cache/mediascribe"
WHISPER="$HOME/.local/bin/whisper"
PROCESS_SCRIPT="$SCRIPT_DIR/process-transcript.py"

# Obsidian paths (configurable via .env)
OBSIDIAN_VAULT="${OBSIDIAN_VAULT:-$HOME/Documents/Obsidian}"
OBSIDIAN_INBOX="${OBSIDIAN_INBOX:-$OBSIDIAN_VAULT/0 INBOX}"

# Ensure cache dir exists
mkdir -p "$CACHE_DIR"

# Slugify function
slugify() {
    echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9 _-]//g' | sed 's/[[:space:]-]\{1,\}/-/g' | sed 's/^-//;s/-$//' | cut -c1-80
}

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
DATE=$(date +%d/%m/%Y)
SLUG=$(slugify "$BASENAME")
FILE_DATE=$(date +%Y-%m-%d)

# Step 1: Transcribe with Whisper
update_status "transcribing"
TRANSCRIPT_FILE="$CACHE_DIR/$BASENAME.txt"

if ! "$WHISPER" "$FILE_PATH" --model medium --language fr --output_format txt --output_dir "$CACHE_DIR" 2>"$CACHE_DIR/whisper-error.log"; then
    ERROR=$(cat "$CACHE_DIR/whisper-error.log" | tail -1)
    update_status "failed" "$ERROR"
    notify "Transcription échouée ❌" "$FILENAME"
    exit 1
fi

# Step 2: Clean transcript with Claude
update_status "summarizing"

ANALYSIS=$(cat "$TRANSCRIPT_FILE" | python3 "$PROCESS_SCRIPT" 2>"$CACHE_DIR/claude-error.log")
if [ -z "$ANALYSIS" ]; then
    ERROR_MSG=$(cat "$CACHE_DIR/claude-error.log" 2>/dev/null | tail -3)
    ANALYSIS="Analyse non disponible. Erreur: $ERROR_MSG"
fi

# Step 3: Save to Obsidian
update_status "saving"

mkdir -p "$OBSIDIAN_INBOX"
OUTPUT_FILE="$OBSIDIAN_INBOX/${FILE_DATE}-${SLUG}.md"

printf '%s\n' "---" \
    "MOC:" \
    "Source: dwhelper" \
    "Auteur:" \
    "Date: $DATE" \
    "---" \
    "" \
    "# $BASENAME" \
    "" > "$OUTPUT_FILE"
printf '%s\n' "$ANALYSIS" >> "$OUTPUT_FILE"

if [ -f "$OUTPUT_FILE" ]; then
    update_status "completed"
    notify "Transcription terminée ✅" "$FILENAME sauvegardé dans Obsidian"
else
    update_status "failed" "Failed to write output file"
    notify "Transcription échouée ❌" "$FILENAME → écriture fichier"
fi

# Cleanup
/opt/homebrew/opt/trash/bin/trash "$TRANSCRIPT_FILE" "$CACHE_DIR/whisper-error.log" "$CACHE_DIR/claude-error.log" 2>/dev/null
