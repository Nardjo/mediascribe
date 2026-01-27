#!/bin/bash
# YouTube transcription script that runs detached from Raycast
# Usage: transcribe-youtube.sh <youtube_url> <job_id> <output_mode>

# Setup PATH for homebrew and local binaries
export PATH="/opt/homebrew/bin:$HOME/.local/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load .env if exists
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -f "$ENV_FILE" ]]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

URL="$1"
JOB_ID="$2"
OUTPUT_MODE="$3"
JOBS_FILE="$HOME/.cache/raycast-transcriber/jobs.json"
YT_SCRIPT="$SCRIPT_DIR/yt-transcribe"

# Obsidian paths (configurable via .env)
OBSIDIAN_VAULT="${OBSIDIAN_VAULT:-$HOME/Documents/Obsidian}"
OBSIDIAN_INBOX="${OBSIDIAN_INBOX:-$OBSIDIAN_VAULT/0 INBOX}"

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

# Run transcription
update_status "transcribing"

# Export PATH so subprocess.run in Python can find yt-dlp
export PATH="/opt/homebrew/bin:$HOME/.local/bin:/usr/local/bin:$PATH"

if "$YT_SCRIPT" "$URL" "$OUTPUT_MODE" 2>/tmp/yt-transcribe-error.log; then
    update_status "completed"
    if [ "$OUTPUT_MODE" = "article" ]; then
        notify "Sauvegardé dans Reader ✅" "Transcription YouTube terminée"
    elif [ "$OUTPUT_MODE" = "both" ]; then
        notify "Sauvegardé partout ✅" "Obsidian + Reader"
    else
        notify "Transcription YouTube terminée ✅" "Sauvegardé dans Obsidian"
        open "$OBSIDIAN_INBOX"
    fi
else
    ERROR=$(cat /tmp/yt-transcribe-error.log | tail -1)
    update_status "failed" "$ERROR"
    if [ "$OUTPUT_MODE" = "article" ]; then
        notify "Échec envoi Reader ❌" "$ERROR"
    elif [ "$OUTPUT_MODE" = "both" ]; then
        notify "Échec transcription ❌" "$ERROR"
    else
        notify "Transcription YouTube échouée ❌" "$ERROR"
    fi
fi
