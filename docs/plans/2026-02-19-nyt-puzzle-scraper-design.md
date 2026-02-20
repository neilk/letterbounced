# NYT Puzzle Scraper Design

**Date:** 2026-02-19

## Problem

The Svelte frontend cannot load today's NYT Letter Boxed puzzle due to CORS restrictions. The previous approach (direct fetch with `corsproxy.io` fallback) no longer works reliably.

## Solution Overview

A GitHub Actions cron job scrapes the NYT puzzle daily and stores it as a static JSON file on the `gh-pages` branch. The frontend fetches the puzzle from its own origin — no CORS, no third-party proxy, no running infrastructure.

## Key Findings

- `window.gameData` in the NYT page HTML contains all puzzle data including `printDate` (e.g. `"2026-02-19"`) and `sides` (e.g. `["RLU","CNA","EHI","SZQ"]`)
- NYT appears to geolocate users by IP and sets puzzle expiration to midnight in the user's local timezone
- The scraper will capture whatever puzzle NYT serves to a GitHub Actions runner (likely a US data center); users significantly east of that timezone may see yesterday's puzzle for a short window — accepted limitation

## Architecture

### 1. Deploy Workflow (modified)

The existing deploy workflow (`.github/workflows/deploy.yml`) builds WASM + Svelte and deploys to GitHub Pages. The final step changes from artifact-based deployment to branch-based:

- After building `dist/`, copy the existing `puzzles/` directory from the `gh-pages` branch into `dist/puzzles/` (preserving accumulated puzzle files)
- Commit and push `dist/` contents to the `gh-pages` branch
- GitHub Pages is configured in repo settings to serve from the `gh-pages` branch root

### 2. Scraper Workflow (new)

New file: `.github/workflows/scrape-puzzle.yml`

- Runs hourly (`0 * * * *` cron)
- Checks out `gh-pages` branch
- Runs `scripts/scrape_puzzle.py` (checked into `main`) which:
  - Fetches `https://www.nytimes.com/puzzles/letter-boxed` with a browser-like User-Agent
  - Parses `window.gameData` from the HTML using regex
  - Extracts `printDate` and `sides`
  - If `puzzles/{printDate}.json` already exists, exits (idempotent)
  - Otherwise writes `{"sides": [...]}` and commits + pushes to `gh-pages`
- Requires `contents: write` permission

The Python script lives in `main` so it is version-controlled with the app.

### 3. Puzzle Storage Format

Files stored at `puzzles/YYYY-MM-DD.json` in the `gh-pages` branch root:

```json
{"sides": ["RLU", "CNA", "EHI", "SZQ"]}
```

`printDate` is omitted — it is redundant with the filename.

### 4. Frontend (PuzzleLoader.svelte)

Replace `loadTodaysPuzzle()`:

1. Calculate user's local date as `YYYY-MM-DD` via `new Date().toLocaleDateString('en-CA')`
2. Fetch `/puzzles/{localDate}.json` (same origin, no CORS)
3. On 404, fall back to yesterday's date
4. On success, parse `sides`, convert to fields array, call `puzzleFields.set(fields)`
5. Remove old NYT direct fetch and `corsproxy.io` fallback

Dropdown option label remains **"Today's New York Times"** — the source is still NYT, just cached.
