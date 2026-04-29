#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
SITE_DIR="$DIR"

echo "☿ Mercury — Landing Page Deploy"
echo "─────────────────────────────────"

if command -v vercel &>/dev/null; then
  echo "Vercel CLI detected. Deploying..."
  vercel deploy "$SITE_DIR" --prod
  exit 0
fi

if command -v netlify &>/dev/null; then
  echo "Netlify CLI detected. Deploying..."
  netlify deploy --dir="$SITE_DIR" --prod
  exit 0
fi

if command -v gh &>/dev/null; then
  echo "GitHub CLI detected. Deploying to gh-pages..."
  git checkout --orphan gh-pages 2>/dev/null || true
  git reset
  cp -r "$SITE_DIR"/* /tmp/mercury-site/
  cp -r "$SITE_DIR"/.nojekyll /tmp/mercury-site/ 2>/dev/null || true
  git add -A
  git commit -m "deploy: landing page" || true
  git push origin gh-pages --force
  echo "Deployed to gh-pages branch. Enable GitHub Pages in repo settings."
  exit 0
fi

echo ""
echo "No deployment CLI found. Install one of:"
echo "  npm i -g vercel     → vercel.com"
echo "  npm i -g netlify-cli → netlify.com"
echo "  brew install gh      → GitHub Pages"
echo ""
echo "Or manually upload the site/ folder to any static host."
echo "Files: $SITE_DIR/"
ls -la "$SITE_DIR"/*.{html,css,js} 2>/dev/null || true