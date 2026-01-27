#!/bin/bash
# Envoie un article à Readwise Reader
# Usage: send-to-readwise.sh <url> <title> <html_file> <tags>

set -e

# Paramètres
URL="$1"
TITLE="$2"
HTML_FILE="$3"
TAGS="$4"

if [[ -z "$URL" ]] || [[ -z "$TITLE" ]] || [[ -z "$HTML_FILE" ]]; then
  echo "Usage: send-to-readwise.sh <url> <title> <html_file> <tags>" >&2
  exit 1
fi

if [[ ! -f "$HTML_FILE" ]]; then
  echo "Error: HTML file not found: $HTML_FILE" >&2
  exit 1
fi

# Get token (env var > .env > mcp.json)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
MCP_CONFIG="$HOME/.claude/mcp.json"

# Load .env if exists
if [[ -f "$ENV_FILE" ]]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

# If not in env, try mcp.json
if [[ -z "$READWISE_TOKEN" ]] && [[ -f "$MCP_CONFIG" ]]; then
    READWISE_TOKEN=$(jq -r '.mcpServers["readwise-reader"].env.READWISE_TOKEN' "$MCP_CONFIG")
fi

if [[ -z "$READWISE_TOKEN" ]] || [[ "$READWISE_TOKEN" == "null" ]]; then
  echo "Error: READWISE_TOKEN not found (set env var, .env, or ~/.claude/mcp.json)" >&2
  exit 1
fi

# Lire le contenu HTML
HTML_CONTENT=$(cat "$HTML_FILE")

# Construire le JSON payload
JSON_PAYLOAD=$(jq -n \
  --arg url "$URL" \
  --arg title "$TITLE" \
  --arg html "$HTML_CONTENT" \
  --arg tags "$TAGS" \
  '{
    url: $url,
    title: $title,
    html: $html,
    tags: ($tags | split(",") | map(gsub("^\\s+|\\s+$"; "")))
  }')

# Appeler l'API Readwise
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Authorization: Token $READWISE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$JSON_PAYLOAD" \
  "https://readwise.io/api/v3/save/")

# Extraire le code HTTP
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" -ge 200 ]] && [[ "$HTTP_CODE" -lt 300 ]]; then
  echo "Success: Article saved to Readwise Reader"
  exit 0
else
  echo "Error: Readwise API returned HTTP $HTTP_CODE" >&2
  echo "Response: $BODY" >&2
  exit 1
fi
