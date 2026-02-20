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

- After building `dist/`, fetch the `puzzles/` directory from the `gh-pages` branch and copy it into `dist/puzzles/` (preserving accumulated puzzle files)
- Commit and push `dist/` contents to the `gh-pages` branch directly
- GitHub Pages is configured in repo settings to serve from the `gh-pages` branch root
- Requires upgrading `contents` permission from `read` to `write`

### 2. Scraper Workflow (new)

New file: `.github/workflows/scrape-puzzle.yml`

- Runs hourly (`0 * * * *` cron) and supports `workflow_dispatch` for manual runs
- Uses two checkout steps:
  - Checks out `main` into `main-src/` (to access the script)
  - Checks out `gh-pages` into the workspace root (the output location)
- Runs `node main-src/scripts/scrape_puzzle.mjs puzzles/`
- On any new puzzle file, commits and pushes to the `gh-pages` branch
- Requires `contents: write` permission
- Node.js 20 is pre-installed on `ubuntu-latest` — no setup action needed

### 3. Scraper Script

New file: `scripts/scrape_puzzle.mjs`

A standalone Node.js ES module. No `package.json` or `node_modules` — uses only Node 18+ built-ins:

- Accepts output directory as a CLI argument (e.g. `node scripts/scrape_puzzle.mjs puzzles/`)
- Fetches `https://www.nytimes.com/puzzles/letter-boxed` with a browser-like `User-Agent` using built-in `fetch()`
- Extracts `window.gameData` from the HTML using a regex
- Parses `printDate` and `sides` from the JSON
- If `{outputDir}/{printDate}.json` already exists, exits 0 (idempotent)
- Otherwise writes `{"sides": [...]}` to that path and exits 0
- On any error (network failure, parse failure, missing data), writes to stderr and exits non-zero

### 4. Puzzle Storage Format

Files stored at `puzzles/YYYY-MM-DD.json` in the `gh-pages` branch root:

```json
{"sides": ["RLU", "CNA", "EHI", "SZQ"]}
```

`printDate` is omitted — it is redundant with the filename.

### 5. Frontend (PuzzleLoader.svelte)

Replace `loadTodaysPuzzle()`:

1. Calculate user's local date as `YYYY-MM-DD` via `new Date().toLocaleDateString('en-CA')`
2. Fetch `/puzzles/{localDate}.json` (same origin, no CORS)
3. On 404, fall back to yesterday's date
4. On success, parse `sides`, convert to fields array, call `puzzleFields.set(fields)`
5. Remove old NYT direct fetch and `corsproxy.io` fallback

Dropdown option label remains **"Today's New York Times"** — the source is still NYT, just cached.
