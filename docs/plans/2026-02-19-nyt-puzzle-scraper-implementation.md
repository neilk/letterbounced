# NYT Puzzle Scraper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken NYT CORS fetch in PuzzleLoader with a daily-scraped static JSON file served from the same origin via GitHub Pages.

**Architecture:** A GitHub Actions cron job scrapes the NYT page hourly, extracts `printDate` and `sides` from `window.gameData`, and commits `puzzles/YYYY-MM-DD.json` to the `gh-pages` branch. The deploy workflow is changed from artifact-based to branch-based, preserving the `puzzles/` directory across deploys. The frontend fetches by local date with a yesterday fallback.

**Tech Stack:** Python 3 (stdlib only) for scraper, GitHub Actions for CI/CD, Svelte/TypeScript for frontend, Playwright for frontend tests.

---

### Task 1: Create Python scraper script with unit tests

**Files:**
- Create: `scripts/scrape_puzzle.py`
- Create: `tests/test_scrape_puzzle.py`

**Step 1: Write the failing tests**

Create `tests/test_scrape_puzzle.py`:

```python
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
from scripts.scrape_puzzle import parse_puzzle


def test_parse_puzzle_extracts_date_and_sides():
    html = 'window.gameData = {"printDate":"2026-02-19","sides":["RLU","CNA","EHI","SZQ"],"dictionary":[]}'
    date, sides = parse_puzzle(html)
    assert date == "2026-02-19"
    assert sides == ["RLU", "CNA", "EHI", "SZQ"]


def test_parse_puzzle_exits_on_missing_data():
    with pytest.raises(SystemExit):
        parse_puzzle("<html>no gameData here</html>")


def test_parse_puzzle_handles_whitespace_in_json():
    html = 'window.gameData = { "printDate" : "2026-03-01" , "sides" : [ "ABC" , "DEF" , "GHI" , "JKL" ] }'
    date, sides = parse_puzzle(html)
    assert date == "2026-03-01"
    assert sides == ["ABC", "DEF", "GHI", "JKL"]
```

**Step 2: Run tests to confirm they fail**

```bash
cd /path/to/letterbounced
python3 -m pytest tests/test_scrape_puzzle.py -v
```

Expected: `ModuleNotFoundError: No module named 'scripts'` (file doesn't exist yet)

**Step 3: Create the scraper script**

Create `scripts/scrape_puzzle.py`:

```python
import json
import re
import sys
from pathlib import Path
from urllib.request import Request, urlopen

NYT_URL = "https://www.nytimes.com/puzzles/letter-boxed"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


def parse_puzzle(html: str) -> tuple[str, list[str]]:
    """Extract printDate and sides from NYT Letter Boxed HTML."""
    date_match = re.search(r'"printDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"', html)
    sides_match = re.search(r'"sides"\s*:\s*(\[[^\]]+\])', html)

    if not date_match or not sides_match:
        print("ERROR: Could not find puzzle data in page", file=sys.stderr)
        sys.exit(1)

    print_date = date_match.group(1)
    sides = json.loads(sides_match.group(1))
    return print_date, sides


def main() -> None:
    output_dir = Path("puzzles")
    output_dir.mkdir(exist_ok=True)

    req = Request(NYT_URL, headers={"User-Agent": USER_AGENT})
    with urlopen(req) as response:
        html = response.read().decode("utf-8")

    print_date, sides = parse_puzzle(html)
    output_file = output_dir / f"{print_date}.json"

    if output_file.exists():
        print(f"Puzzle for {print_date} already exists, skipping.")
        return

    output_file.write_text(json.dumps({"sides": sides}))
    print(f"Wrote puzzle for {print_date}: {sides}")


if __name__ == "__main__":
    main()
```

**Step 4: Run tests to confirm they pass**

```bash
python3 -m pytest tests/test_scrape_puzzle.py -v
```

Expected: all 3 tests PASS

**Step 5: Run the script manually to verify it works end-to-end**

```bash
mkdir -p /tmp/puzzle-test && cd /tmp/puzzle-test
python3 /path/to/letterbounced/scripts/scrape_puzzle.py
cat puzzles/*.json
```

Expected: a JSON file like `{"sides": ["RLU", "CNA", "EHI", "SZQ"]}` with today's date.

**Step 6: Commit**

```bash
git add scripts/scrape_puzzle.py tests/test_scrape_puzzle.py
git commit -m "feat: add NYT puzzle scraper script"
```

---

### Task 2: Create the scraper GitHub Actions workflow

**Files:**
- Create: `.github/workflows/scrape-puzzle.yml`

**Step 1: Create the workflow file**

```yaml
name: Scrape NYT Puzzle

on:
  schedule:
    - cron: '0 * * * *'  # every hour
  workflow_dispatch:       # allow manual trigger

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

      - name: Get scraper script from main
        run: |
          git fetch origin main
          git checkout origin/main -- scripts/scrape_puzzle.py

      - name: Run scraper
        run: python3 scripts/scrape_puzzle.py

      - name: Commit and push if new puzzle found
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add puzzles/
          git diff --staged --quiet || (git commit -m "Add puzzle $(date -u +%Y-%m-%d)" && git push)
```

**Step 2: Commit**

```bash
git add .github/workflows/scrape-puzzle.yml
git commit -m "feat: add hourly puzzle scraper workflow"
```

---

### Task 3: Update the deploy workflow for branch-based GitHub Pages

**Files:**
- Modify: `.github/workflows/deploy.yml`

The current workflow uses `actions/configure-pages`, `actions/upload-pages-artifact`, and a separate `deploy` job with `actions/deploy-pages`. Replace the last two build steps and the entire `deploy` job with a shell script that commits to the `gh-pages` branch directly. Also change `permissions` from `pages: write / id-token: write` to `contents: write`.

**Step 1: Replace the deploy mechanism**

In `.github/workflows/deploy.yml`, make the following changes:

1. Change the top-level `permissions` block from:
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

2. In the `build` job, replace these three steps:
```yaml
      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './web/svelte-app/dist'
```
with:
```yaml
      - name: Deploy to gh-pages branch
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

          # Save built site
          cp -r web/svelte-app/dist /tmp/site

          # Fetch gh-pages branch
          git fetch origin gh-pages || true

          # Switch to gh-pages (create orphan on first run)
          if git rev-parse --verify origin/gh-pages > /dev/null 2>&1; then
            git checkout gh-pages
            if [ -d puzzles ]; then
              cp -r puzzles /tmp/puzzles
            fi
          else
            git checkout --orphan gh-pages
            git rm -rf . --quiet
          fi

          # Clear current content
          find . -mindepth 1 -maxdepth 1 -not -name '.git' -exec rm -rf {} +

          # Copy new site
          cp -r /tmp/site/. .

          # Restore puzzles
          if [ -d /tmp/puzzles ]; then
            cp -r /tmp/puzzles puzzles
          fi

          # Prevent Jekyll processing
          touch .nojekyll

          git add -A
          git diff --staged --quiet || git commit -m "Deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
          git push origin gh-pages
```

3. Delete the entire `deploy` job (the second job in the file, starting with `deploy:`).

**Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: switch to branch-based GitHub Pages deployment"
```

---

### Task 4: Manual — initialize gh-pages branch and update Pages settings

This task must be done before merging to main. Run these commands locally:

**Step 1: Initialize the gh-pages branch**

```bash
# From the repo root, on main branch
git checkout --orphan gh-pages
git rm -rf . --quiet
touch .nojekyll
git add .nojekyll
git commit -m "Initialize gh-pages branch"
git push origin gh-pages
git checkout main
```

**Step 2: Update GitHub Pages settings**

In the GitHub repo settings (https://github.com/YOUR_USERNAME/letterbounced/settings/pages):
- Source: **Deploy from a branch**
- Branch: **gh-pages** / **/ (root)**
- Click **Save**

After saving, the next push to `main` will trigger the deploy workflow, which will populate `gh-pages` with the built site.

---

### Task 5: Update PuzzleLoader.svelte

**Files:**
- Modify: `web/svelte-app/src/lib/PuzzleLoader.svelte`

**Step 1: Replace `loadTodaysPuzzle()`**

Replace the entire `loadTodaysPuzzle` function (lines 22–58) with:

```typescript
  async function loadTodaysPuzzle(): Promise<void> {
    loading = true;
    try {
      const localDate: string = new Date().toLocaleDateString('en-CA');
      let response: Response = await fetch(`${import.meta.env.BASE_URL}puzzles/${localDate}.json`);

      if (response.status === 404) {
        // Fall back to yesterday for users ahead of the scraper's timezone
        const yesterday: Date = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayDate: string = yesterday.toLocaleDateString('en-CA');
        response = await fetch(`${import.meta.env.BASE_URL}puzzles/${yesterdayDate}.json`);
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

**Step 2: Add a sample puzzle file for local dev**

```bash
mkdir -p web/svelte-app/public/puzzles
echo '{"sides":["RLU","CNA","EHI","SZQ"]}' > web/svelte-app/public/puzzles/$(date +%Y-%m-%d).json
```

Add this file to `.gitignore` so sample puzzles aren't committed:

```bash
echo 'web/svelte-app/public/puzzles/' >> .gitignore
```

**Step 3: Commit**

```bash
git add web/svelte-app/src/lib/PuzzleLoader.svelte .gitignore
git commit -m "feat: load today's puzzle from static JSON file"
```

---

### Task 6: Add Playwright test for puzzle loading

**Files:**
- Modify: `web/svelte-app/tests/basic.spec.js`

**Step 1: Add the test**

Add this test to `web/svelte-app/tests/basic.spec.js` (before the closing of the file):

```javascript
test('load today\'s NYT puzzle from static file', async ({ page }) => {
  const today = new Date().toLocaleDateString('en-CA');

  // Mock the puzzle endpoint
  await page.route(`**/puzzles/${today}.json`, route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ sides: ['NUO', 'ERT', 'YIA', 'LCP'] })
    });
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Select "Today's New York Times" from the dropdown
  await page.selectOption('.pill-select', '__NYT_TODAY__');

  // Verify letters were loaded (first input should be N)
  const inputs = page.locator('.letter-box-container input[type="text"]');
  await expect(inputs.nth(0)).toHaveValue('N', { timeout: 5000 });
});
```

**Step 2: Run the tests locally to verify**

```bash
cd web/svelte-app
npx playwright test tests/basic.spec.js --headed
```

Expected: all tests pass including the new one.

**Step 3: Commit**

```bash
git add web/svelte-app/tests/basic.spec.js
git commit -m "test: add Playwright test for puzzle loading"
```

---

### Task 7: Merge to main and verify

**Step 1: Ensure all tests pass**

```bash
cargo test
cd web/svelte-app && npm run build && npx playwright test
```

**Step 2: Merge the branch**

```bash
git checkout main
git merge nyt-proxy-fetch
git push origin main
```

**Step 3: Verify the deploy workflow runs and succeeds**

Watch the Actions tab on GitHub. The deploy workflow should:
1. Build WASM + Svelte
2. Push built site to `gh-pages`, preserving `puzzles/`

**Step 4: Trigger the scraper manually**

In the GitHub Actions tab, manually trigger "Scrape NYT Puzzle" (workflow_dispatch). Verify it creates `puzzles/YYYY-MM-DD.json` in the `gh-pages` branch.

**Step 5: Verify the live site**

Visit the deployed GitHub Pages URL and select "Today's New York Times" from the dropdown. The puzzle should load.
