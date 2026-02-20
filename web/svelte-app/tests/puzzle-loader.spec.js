import { test, expect } from '@playwright/test';

// Note: this file imports from @playwright/test directly (not ./fixture) because
// page.route() must be set up before page.goto(). The custom fixture in fixture.ts
// navigates to '/' unconditionally before yielding the page, which would be too late.

test("loads today's NYT puzzle from static JSON", async ({ page }) => {
  await page.route(url => url.pathname.startsWith('/puzzles/'), route => {
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
  const requestedUrls = [];
  await page.route(url => url.pathname.startsWith('/puzzles/'), route => {
    requestedUrls.push(route.request().url());
    if (requestedUrls.length === 1) {
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

  // Verify two requests were made and the second was for yesterday's date
  expect(requestedUrls).toHaveLength(2);
  const todayStr = new Date().toLocaleDateString('en-CA');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA');
  expect(requestedUrls[0]).toContain(`/puzzles/${todayStr}.json`);
  expect(requestedUrls[1]).toContain(`/puzzles/${yesterdayStr}.json`);
});
