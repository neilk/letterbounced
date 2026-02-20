import { test, expect } from '@playwright/test';

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
  let requestCount = 0;
  await page.route(url => url.pathname.startsWith('/puzzles/'), route => {
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
