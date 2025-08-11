#!/usr/bin/env bash
set -euo pipefail

# Configurable
PROJECT_NAME=${PROJECT_NAME:-"YouTube Scraper"}
# Generate a compliant project id: 6-30 chars, lowercase letters/digits/hyphens, start with letter
RND=$(uuidgen | tr '[:upper:]' '[:lower:]' | tr -d '-' | cut -c1-8)
PROJECT_ID=${PROJECT_ID:-"ytscrpr-${RND}"}
ADD_TO_VERCEL=${ADD_TO_VERCEL:-"true"}

echo "Project ID: $PROJECT_ID"

# Login (interactive)
gcloud auth login

# Create project and set as current (ignore if exists)
if ! gcloud projects describe "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud projects create "$PROJECT_ID" --name="$PROJECT_NAME"
fi
gcloud config set project "$PROJECT_ID"

# Enable required APIs
gcloud services enable youtube.googleapis.com apikeys.googleapis.com

# Create the API key and capture key string directly
KEY_NAME=$(gcloud services api-keys create --display-name='yt-scraper-key' --format='value(name)')
YOUTUBE_API_KEY=$(gcloud services api-keys create --display-name='yt-scraper-key-dup' --format='value(keyString)')

# If key string wasn't captured (older CLI behavior), fall back to describing the last created key
if [ -z "$YOUTUBE_API_KEY" ]; then
  # List keys and get the newest one
  KEY_NAME=$(gcloud services api-keys list --format='value(name)' --limit=1)
  YOUTUBE_API_KEY=$(gcloud services api-keys describe "$KEY_NAME" --format='value(keyString)' || true)
fi

echo "Created key: $KEY_NAME"
echo "Key: $YOUTUBE_API_KEY"

# Restrict key to YouTube Data API v3 only
gcloud services api-keys update "$KEY_NAME" --api-target=service=youtube.googleapis.com

echo "Restricted API key to YouTube Data API v3."

# Save to .env.local
( grep -v '^YOUTUBE_API_KEY=' .env.local 2>/dev/null || true ) > .env.local.tmp || true
echo "YOUTUBE_API_KEY=$YOUTUBE_API_KEY" >> .env.local.tmp
mv .env.local.tmp .env.local

echo "Wrote YOUTUBE_API_KEY to .env.local"

# Optionally add to Vercel envs
if [ "$ADD_TO_VERCEL" = "true" ]; then
  if vercel whoami >/dev/null 2>&1; then
    printf "%s" "$YOUTUBE_API_KEY" | vercel env add YOUTUBE_API_KEY production --yes || true
    printf "%s" "$YOUTUBE_API_KEY" | vercel env add YOUTUBE_API_KEY preview --yes || true
    printf "%s" "$YOUTUBE_API_KEY" | vercel env add YOUTUBE_API_KEY development --yes || true
    echo "Added YOUTUBE_API_KEY to Vercel envs."
  else
    echo "Vercel CLI not authenticated; skipping Vercel env add."
  fi
fi

echo "Done."
