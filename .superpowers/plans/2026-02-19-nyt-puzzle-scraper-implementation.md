# NYT Puzzle Scraper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace direct NYT fetches in the frontend with a CI-scraped static JSON cache served from the same origin, using a Node.js scraper script and branch-based GitHub Pages deployment.

**Architecture:** A Node.js `.mjs` script fetches the NYT puzzle hourly in GitHub Actions and writes `puzzles/YYYY-MM-DD.json` to the `gh-pages` branch. The deploy workflow switches from artifact-based to `peaceiris/actions-gh-pages` (branch-based), using `keep_files: true` to preserve accumulated puzzle files. The frontend fetches by local date with a yesterday fallback.

**Tech Stack:** Node.js 20 (built-in `fetch`, `node:test`, `node:fs`), GitHub Actions, `peaceiris/actions-gh-pages@v3`, Svelte/TypeScript, Playwright

---

### Task 1: Write the Node.js scraper and its tests (TDD)

**Files:**
- Create: `tests/test_scrape_puzzle.mjs`
- Create: `scripts/scrape_puzzle.mjs`
- Delete: `scripts/scrape_puzzle.py`, `tests/test_scrape_puzzle.py`

**Step 1: Write the failing tests**

Create `tests/test_scrape_puzzle.mjs`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePuzzle } from '../scripts/scrape_puzzle.mjs';

test('parsePuzzle extracts date and sides', () => {
  const html = 'window.gameData = {"printDate":"2026-02-19","sides":["RLU","CNA","EHI","SZQ"],"dictionary":[]}';
  const { printDate, sides } = parsePuzzle(html);
  assert.equal(printDate, '2026-02-19');
  assert.deepEqual(sides, ['RLU', 'CNA', 'EHI', 'SZQ']);
});

test('parsePuzzle throws on missing data', () => {
  assert.throws(
    () => parsePuzzle('<html>no gameData here</html>'),
    /Could not find puzzle data/
  );
});

test('parsePuzzle handles whitespace in JSON', () => {
  const html = 'window.gameData = { "printDate" : "2026-03-01" , "sides" : [ "ABC" , "DEF" , "GHI" , "JKL" ] }';
  const { printDate, sides } = parsePuzzle(html);
  assert.equal(printDate, '2026-03-01');
  assert.deepEqual(sides, ['ABC', 'DEF', 'GHI', 'JKL']);
});
```

**Step 2: Run the test to confirm it fails**

```bash
node --test tests/test_scrape_puzzle.mjs
```

Expected: error — `Cannot find module '../scripts/scrape_puzzle.mjs'`

**Step 3: Implement the scraper**

Create `scripts/scrape_puzzle.mjs`:

```javascript
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NYT_URL = 'https://www.nytimes.com/puzzles/letter-boxed';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0.0.0 Safari/537.36';

export function parsePuzzle(html) {
  const dateMatch = html.match(/"printDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
  const sidesMatch = html.match(/"sides"\s*:\s*(\[[^\]]+\])/);
  if (!dateMatch || !sidesMatch) {
    throw new Error('Could not find puzzle data in page');
  }
  return {
    printDate: dateMatch[1],
    sides: JSON.parse(sidesMatch[1]),
  };
}

async function main() {
  const outputDir = process.argv[2] || 'puzzles';
  mkdirSync(outputDir, { recursive: true });

  const response = await fetch(NYT_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) {
    console.error(`HTTP error: ${response.status}`);
    process.exit(1);
  }

  let printDate, sides;
  try {
    ({ printDate, sides } = parsePuzzle(await response.text()));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const outputFile = join(outputDir, `${printDate}.json`);
  if (existsSync(outputFile)) {
    console.log(`Puzzle for ${printDate} already exists, skipping.`);
    return;
  }

  writeFileSync(outputFile, JSON.stringify({ sides }));
  console.log(`Wrote puzzle for ${printDate}: ${sides}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1); });
}
```

The `if (process.argv[1] === ...)` guard means `main()` only runs when the file is executed directly — not when imported by tests.

**Step 4: Run the tests to confirm they pass**

```bash
node --test tests/test_scrape_puzzle.mjs
```

Expected output includes:
```
ℹ tests 3
ℹ pass 3
ℹ fail 0
```

**Step 5: Delete the Python files**

```bash
git rm scripts/scrape_puzzle.py tests/test_scrape_puzzle.py
rm -rf scripts/__pycache__ tests/__pycache__
```

**Step 6: Commit**

```bash
git add scripts/scrape_puzzle.mjs tests/test_scrape_puzzle.mjs
git commit -m "Replace Python scraper with Node.js .mjs (no dependencies)"
```

---

### Task 2: Create the scrape-puzzle GitHub Actions workflow

**Files:**
- Create: `.github/workflows/scrape-puzzle.yml`

**Step 1: Create the workflow file**

Create `.github/workflows/scrape-puzzle.yml`:

```yaml
name: Scrape NYT Puzzle

on:
  schedule:
    - cron: '0 * * * *'  # every hour
  workflow_dispatch:

permissions:
  contents: write

jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout gh-pages
        uses: actions/checkout@v4
        with:
          ref: gh-pages

      - name: Checkout main (for scraper script)
        uses: actions/checkout@v4
        with:
          ref: main
          path: main-src

      - name: Run scraper
        run: node main-src/scripts/scrape_puzzle.mjs puzzles/

      - name: Commit and push if new puzzle
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add puzzles/
          git diff --staged --quiet || (git commit -m "Add puzzle $(date -u +%Y-%m-%d)" && git push)
```

**Step 2: Commit**

```bash
git add .github/workflows/scrape-puzzle.yml
git commit -m "Add hourly scrape-puzzle workflow"
```

---

### Task 3: Update deploy.yml to branch-based deployment

The current workflow uses `actions/configure-pages`, `actions/upload-pages-artifact`, and a separate `deploy` job. Replace the last two steps and the entire `deploy` job with `peaceiris/actions-gh-pages@v3`. Also add a scraper unit-test step and change permissions.

**Files:**
- Modify: `.github/workflows/deploy.yml`

**Step 1: Update permissions**

Change the top-level `permissions` block from:
```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```
to:
```yaml
permissions:
  contents: write
```

**Step 2: Add scraper unit-test step**

Insert this step immediately after the `Checkout` step (before `Setup Rust`):
```yaml
      - name: Test scraper script
        run: node --test tests/test_scrape_puzzle.mjs
```

**Step 3: Replace artifact deploy steps with peaceiris action**

Remove these two steps from the `build` job:
```yaml
      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './web/svelte-app/dist'
```

And add in their place:
```yaml
      - name: Deploy to gh-pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./web/svelte-app/dist
          keep_files: true
```

`keep_files: true` preserves files already on `gh-pages` that are not in `dist/` (i.e. the `puzzles/` directory written by the scraper workflow).

**Step 4: Delete the entire `deploy` job**

Remove the second top-level job from the file (everything from `deploy:` to the end):
```yaml
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

**Step 5: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "Switch to branch-based Pages deploy, run scraper tests in CI"
```

---

### Task 4: Update PuzzleLoader.svelte (TDD)

**Files:**
- Create: `web/svelte-app/tests/puzzle-loader.spec.js`
- Modify: `web/svelte-app/src/lib/PuzzleLoader.svelte`

**Step 1: Write the failing Playwright tests**

Create `web/svelte-app/tests/puzzle-loader.spec.js`:

```javascript
import { test, expect } from '@playwright/test';

test("loads today's NYT puzzle from static JSON", async ({ page }) => {
  await page.route('**/puzzles/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sides: ['ABC', 'DEF', 'GHI', 'JKL'] }),
    });
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.selectOption('.pill-select', { label: "Today's New York Times" });

  const inputs = page.locator('.letter-box-container input[type="text"]');
  await expect(inputs.nth(0)).toHaveValue('A', { timeout: 5000 });
  await expect(inputs.nth(3)).toHaveValue('D', { timeout: 5000 });
});

test('falls back to yesterday on 404', async ({ page }) => {
  let requestCount = 0;
  await page.route('**/puzzles/**', route => {
    requestCount++;
    if (requestCount === 1) {
      route.fulfill({ status: 404 });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ sides: ['XYZ', 'QRS', 'TUV', 'WXY'] }),
      });
    }
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.selectOption('.pill-select', { label: "Today's New York Times" });

  const inputs = page.locator('.letter-box-container input[type="text"]');
  await expect(inputs.nth(0)).toHaveValue('X', { timeout: 5000 });
});
```

Note: this file imports directly from `@playwright/test`, not the custom fixture, because it needs to set up routes before navigation.

**Step 2: Run the tests to confirm they fail**

```bash
cd web/svelte-app && npx playwright test tests/puzzle-loader.spec.js
```

Expected: tests fail — `PuzzleLoader` still fetches from NYT directly, not `./puzzles/...`

**Step 3: Update PuzzleLoader.svelte**

In `web/svelte-app/src/lib/PuzzleLoader.svelte`, replace the entire `loadTodaysPuzzle` function (lines 22–58):

```typescript
  async function loadTodaysPuzzle(): Promise<void> {
    loading = true;
    try {
      const today: string = new Date().toLocaleDateString('en-CA');
      let response: Response = await fetch(`./puzzles/${today}.json`);

      if (response.status === 404) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr: string = yesterday.toLocaleDateString('en-CA');
        response = await fetch(`./puzzles/${yesterdayStr}.json`);
      }

      if (!response.ok) {
        alert("Today's puzzle is not available yet. Please try again later.");
        return;
      }

      const data = await response.json() as { sides: string[] };
      const fields: string[] = data.sides.flatMap((side: string) => side.split(''));
      puzzleFields.set(fields);
    } catch (error) {
      const message: string = error instanceof Error ? error.message : 'Unknown error';
      alert("Failed to load today's puzzle: " + message);
    } finally {
      loading = false;
    }
  }
```

**Step 4: Run the Playwright tests to confirm they pass**

```bash
cd web/svelte-app && npx playwright test tests/puzzle-loader.spec.js
```

Expected: both tests pass.

**Step 5: Run the full Playwright suite**

```bash
cd web/svelte-app && npx playwright test
```

Expected: all tests pass.

**Step 6: Commit**

```bash
git add web/svelte-app/src/lib/PuzzleLoader.svelte \
        web/svelte-app/tests/puzzle-loader.spec.js
git commit -m "Fetch puzzle from static JSON instead of NYT directly"
```

---

## Verification After Merge

1. **Scraper unit tests**: `node --test tests/test_scrape_puzzle.mjs` — 3 pass.
2. **Playwright tests**: `cd web/svelte-app && npx playwright test` — all pass.
3. **Manual scraper run**: `node scripts/scrape_puzzle.mjs /tmp/test-puzzles/` — creates `/tmp/test-puzzles/YYYY-MM-DD.json`.
4. **CI**: Push to `main`, watch Actions tab — deploy workflow should run scraper tests then push to `gh-pages`.
5. **Scraper workflow**: Trigger `workflow_dispatch` on "Scrape NYT Puzzle" — confirm a puzzle JSON appears on `gh-pages`.
6. **Live site**: Visit the deployed URL, select "Today's New York Times" — puzzle loads with no CORS errors.

## Notes

- The `gh-pages` branch must exist before the scraper workflow runs. The first successful deploy creates it via `peaceiris/actions-gh-pages`.
- In local dev (`npm run dev`), "Today's New York Times" returns 404 (no `puzzles/` dir). To test locally, place `web/svelte-app/public/puzzles/YYYY-MM-DD.json` — Vite serves `public/` at root during dev.
- `keep_files: true` in `peaceiris/actions-gh-pages` ensures puzzle files (written by the scraper) are never deleted by a deploy run.
