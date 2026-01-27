#!/bin/bash
# Article processing script that runs detached from Raycast
# Usage: process-article.sh <url> <job_id> <output_mode> <source_type> [readwise_id]

set -e

# Setup PATH for homebrew and local binaries
export PATH="/opt/homebrew/bin:$HOME/.local/bin:/usr/local/bin:$PATH"

URL="$1"
JOB_ID="$2"
OUTPUT_MODE="$3"
SOURCE_TYPE="$4"
READWISE_ID="$5"

JOBS_FILE="$HOME/.cache/raycast-transcriber/jobs.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROCESS_SCRIPT="$SCRIPT_DIR/process-transcript.py"
SEND_TO_READWISE="$SCRIPT_DIR/send-to-readwise.sh"

# Obsidian paths (configurable via .env)
OBSIDIAN_VAULT="${OBSIDIAN_VAULT:-$HOME/Documents/Obsidian}"
OBSIDIAN_INBOX="${OBSIDIAN_INBOX:-$OBSIDIAN_VAULT/0 INBOX}"
TRANSCRIPTS_DIR="$OBSIDIAN_INBOX"

# Token sources (in order of priority):
# 1. Environment variable READWISE_TOKEN
# 2. .env file in project root
# 3. ~/.claude/mcp.json
ENV_FILE="$SCRIPT_DIR/../.env"
MCP_CONFIG="$HOME/.claude/mcp.json"

# Load .env if exists
if [[ -f "$ENV_FILE" ]]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

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

# Function to extract text from HTML
extract_text_from_html() {
    local html="$1"

    # Try lynx first (best results)
    if command -v lynx &> /dev/null; then
        echo "$html" | lynx -stdin -dump -nolist -width=1000 2>/dev/null
        return
    fi

    # Fall back to textutil on macOS
    if command -v textutil &> /dev/null; then
        local tmp_html=$(mktemp)
        echo "$html" > "$tmp_html"
        textutil -convert txt -stdout "$tmp_html" 2>/dev/null
        rm -f "$tmp_html"
        return
    fi

    # Last resort: crude HTML stripping with sed
    echo "$html" | sed 's/<script[^>]*>.*<\/script>//g' | \
                   sed 's/<style[^>]*>.*<\/style>//g' | \
                   sed 's/<[^>]*>//g' | \
                   sed 's/&nbsp;/ /g' | \
                   sed 's/&amp;/\&/g' | \
                   sed 's/&lt;/</g' | \
                   sed 's/&gt;/>/g' | \
                   tr -s '[:space:]' ' '
}

# Function to extract title from HTML
extract_title_from_html() {
    local html="$1"
    # Try to extract <title> tag content
    echo "$html" | grep -oP '(?<=<title>)[^<]+' | head -1 | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

# Function to create safe filename
slugify() {
    echo "$1" | tr '[:upper:]' '[:lower:]' | \
                sed 's/[^a-z0-9]/-/g' | \
                sed 's/--*/-/g' | \
                sed 's/^-//;s/-$//' | \
                cut -c1-80
}

# Function to archive Readwise article
archive_readwise_article() {
    local article_id="$1"

    if [[ -z "$article_id" ]]; then
        return 0
    fi

    # Get token (env var > mcp.json)
    local token="$READWISE_TOKEN"

    if [[ -z "$token" ]] && [[ -f "$MCP_CONFIG" ]]; then
        token=$(jq -r '.mcpServers["readwise-reader"].env.READWISE_TOKEN' "$MCP_CONFIG")
    fi

    if [[ -z "$token" ]] || [[ "$token" == "null" ]]; then
        echo "Warning: Readwise token not found, cannot archive" >&2
        return 1
    fi

    curl -s -X PATCH \
        -H "Authorization: Token $token" \
        -H "Content-Type: application/json" \
        -d '{"location": "archive"}' \
        "https://readwise.io/api/v3/update/$article_id/" > /dev/null
}

# Main execution
update_status "transcribing"

EXTRACT_SCRIPT="$SCRIPT_DIR/extract-article.py"

echo "Extracting article from: $URL"

# Use Python extraction script
EXTRACT_RESULT=$(python3 "$EXTRACT_SCRIPT" "$URL" 2>/tmp/article-extract-error.log)

if [[ -z "$EXTRACT_RESULT" ]] || echo "$EXTRACT_RESULT" | jq -e '.error' > /dev/null 2>&1; then
    ERROR="Failed to extract article content"
    update_status "failed" "$ERROR"
    notify "Échec extraction contenu ❌" "$ERROR"
    exit 1
fi

# Parse JSON result
TITLE=$(echo "$EXTRACT_RESULT" | jq -r '.title')
TEXT_CONTENT=$(echo "$EXTRACT_RESULT" | jq -r '.content')

echo "Title: $TITLE"

if [[ -z "$TEXT_CONTENT" ]] || [[ ${#TEXT_CONTENT} -lt 100 ]]; then
    ERROR="Article content too short or empty"
    update_status "failed" "$ERROR"
    notify "Échec extraction contenu ❌" "$ERROR"
    exit 1
fi

echo "Extracted ${#TEXT_CONTENT} characters of text"

update_status "summarizing"

DATE=$(date +%Y-%m-%d)

# Function to save concept to Obsidian
save_to_obsidian() {
    local analysis="$1"
    local title="$2"
    local url="$3"
    local mode_label="$4"

    mkdir -p "$TRANSCRIPTS_DIR"

    local slug=$(slugify "$title")
    local filename="${DATE}-${slug}.md"
    local output_path="$TRANSCRIPTS_DIR/$filename"

    cat > "$output_path" << EOF
---
MOC:
Source: $url
Auteur:
Date: $DATE
Mode: $mode_label
---

# $title

$analysis

---

#### Contenu source

$TEXT_CONTENT
EOF

    echo "$output_path"
}

# Function to save article to Readwise
save_to_readwise() {
    local analysis="$1"
    local title="$2"
    local url="$3"

    local tags="article"
    local content="$analysis"

    # Extract tags from Claude output
    if [[ "$content" == TAGS:* ]]; then
        local first_line=$(echo "$content" | head -1)
        local claude_tags=$(echo "$first_line" | sed 's/TAGS:[[:space:]]*//')
        tags="article,$claude_tags"
        content=$(echo "$content" | tail -n +2)
    fi

    # Create temp HTML file
    local html_file=$(mktemp)
    echo "<html><body>" > "$html_file"
    while IFS= read -r line; do
        if [[ "$line" == "### "* ]]; then
            echo "<h3>${line#\#\#\# }</h3>" >> "$html_file"
        else
            echo "$line" >> "$html_file"
        fi
    done <<< "$content"
    echo "</body></html>" >> "$html_file"

    # Send to Readwise
    "$SEND_TO_READWISE" "$url" "$title" "$html_file" "$tags"
    local result=$?

    rm -f "$html_file"
    return $result
}

# Process based on output mode
if [ "$OUTPUT_MODE" = "article" ]; then
    # Generate article and send to Readwise
    ANALYSIS=$(echo "$TEXT_CONTENT" | python3 "$PROCESS_SCRIPT" "article" 2>/tmp/article-process-error.log)

    if [[ -z "$ANALYSIS" ]]; then
        ERROR=$(cat /tmp/article-process-error.log | tail -1)
        update_status "failed" "$ERROR"
        notify "Échec analyse Claude ❌" "$ERROR"
        exit 1
    fi

    update_status "saving"

    if save_to_readwise "$ANALYSIS" "$TITLE" "$URL"; then
        update_status "completed"
        notify "Sauvegardé dans Reader ✅" "$TITLE"

        # Archive original if from Readwise
        if [[ "$SOURCE_TYPE" = "readwise" ]] && [[ -n "$READWISE_ID" ]]; then
            archive_readwise_article "$READWISE_ID"
        fi
    else
        update_status "failed" "Readwise save failed"
        notify "Échec envoi Reader ❌" "$TITLE"
        exit 1
    fi

elif [ "$OUTPUT_MODE" = "both" ]; then
    # Generate both analyses
    echo "Generating concept analysis..."
    CONCEPT_ANALYSIS=$(echo "$TEXT_CONTENT" | python3 "$PROCESS_SCRIPT" "concept" 2>/tmp/article-process-error.log)

    echo "Generating article analysis..."
    ARTICLE_ANALYSIS=$(echo "$TEXT_CONTENT" | python3 "$PROCESS_SCRIPT" "article" 2>/tmp/article-process-error.log)

    update_status "saving"

    # Save to Obsidian
    OUTPUT_PATH=$(save_to_obsidian "$CONCEPT_ANALYSIS" "$TITLE" "$URL" "both")
    echo "Saved to Obsidian: $OUTPUT_PATH"

    # Save to Readwise
    if save_to_readwise "$ARTICLE_ANALYSIS" "$TITLE" "$URL"; then
        echo "Saved to Readwise"
    else
        echo "Warning: Readwise save failed"
    fi

    update_status "completed"
    notify "Sauvegardé partout ✅" "Obsidian + Reader"

    # Archive original if from Readwise
    if [[ "$SOURCE_TYPE" = "readwise" ]] && [[ -n "$READWISE_ID" ]]; then
        archive_readwise_article "$READWISE_ID"
    fi

    open "$TRANSCRIPTS_DIR"

else
    # Concept mode: save to Obsidian
    ANALYSIS=$(echo "$TEXT_CONTENT" | python3 "$PROCESS_SCRIPT" "concept" 2>/tmp/article-process-error.log)

    if [[ -z "$ANALYSIS" ]]; then
        ERROR=$(cat /tmp/article-process-error.log | tail -1)
        update_status "failed" "$ERROR"
        notify "Échec analyse Claude ❌" "$ERROR"
        exit 1
    fi

    update_status "saving"

    OUTPUT_PATH=$(save_to_obsidian "$ANALYSIS" "$TITLE" "$URL" "concept")

    update_status "completed"
    notify "Transcription article terminée ✅" "Sauvegardé dans Obsidian"

    # Archive original if from Readwise
    if [[ "$SOURCE_TYPE" = "readwise" ]] && [[ -n "$READWISE_ID" ]]; then
        archive_readwise_article "$READWISE_ID"
    fi

    open "$TRANSCRIPTS_DIR"
fi
