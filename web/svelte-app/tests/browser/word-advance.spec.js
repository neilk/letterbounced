import { expect, test } from './fixture';

function getLetterInputs(page) {
  return page.locator('.letter-box-container input[type="text"]');
}

async function enterPuzzle(page, letters) {
  // Switch to solve mode first to enable editing
  const solveModeCheckbox = page.locator('#playMode');
  await solveModeCheckbox.check();

  const inputs = getLetterInputs(page);
  for (let i = 0; i < letters.length; i++) {
    await inputs.nth(i).fill(letters[i]);
  }
}

async function enterLetters(page, letterIndices) {
  const inputs = getLetterInputs(page);
  for (const index of letterIndices) {
    await inputs.nth(index).click();
    await page.waitForTimeout(100);
  }
}

test('clicking valid word shows checkmark button and advances to next word', async ({ page }) => {
  const solveModeCheckbox = page.locator('#playMode');
  const playerSolutionContainer = page.locator('.player-solution-container');

  // Using the puzzle: N U O (top: 0-2), E R T (right: 3-5), Y I A (bottom: 6-8), L C P (left: 9-11)
  await enterPuzzle(page, ['N', 'U', 'O', 'E', 'R', 'T', 'Y', 'I', 'A', 'L', 'C', 'P']);

  // Step 2: Switch to play mode
  await solveModeCheckbox.uncheck();
  await expect(solveModeCheckbox).not.toBeChecked();


  // Wait for dictionary to load
  await page.waitForTimeout(500);

  // Should not have the next word button...
  await expect(page.locator('.next-word-button')).not.toBeVisible();

  // Begin clicking letters
  await enterLetters(page, [0, 3, 8]) // NEA

  // We should have formed "NEA" so far
  const wordSpan = playerSolutionContainer.locator('.word');
  await expect(wordSpan).toHaveText('NEA');

  // That's not a word, so we should still not have the next word button
  await expect(page.locator('.next-word-button')).not.toBeVisible();

  await enterLetters(page, [4]) // R
  await page.waitForTimeout(100);

  await expect(wordSpan).toHaveText('NEAR');

  // That's now a word! 
  const checkmarkButton = page.locator('.next-word-button');
  await expect(checkmarkButton).toBeVisible({ timeout: 2000 });

  // Click the checkmark button
  await checkmarkButton.click();
  await page.waitForTimeout(500);

  // The solution should now have 2 words separated by "→"
  const solutionText = await playerSolutionContainer.textContent();
  expect(solutionText).toContain('→');

  // Verify that the second word starts with the last letter of the first word (D)
  const words = playerSolutionContainer.locator('.word');
  await expect(words).toHaveCount(2);

  await expect(words.nth(0)).toHaveText('NEAR');

  // The second word should start with "R"
  const secondWord = await words.nth(1).textContent();
  expect(secondWord).toMatch(/^R/);

  // But it should not have the checkmark button visible yet
  await expect(page.locator('.next-word-button')).not.toBeVisible();

});

test('checkmark button only appears for valid dictionary words', async ({ page }) => {
  const solveModeCheckbox = page.locator('#playMode');

  // Step 1: Enter a puzzle
  await enterPuzzle(page, ['X', 'Y', 'Z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);

  // Step 2: Switch to play mode
  await solveModeCheckbox.uncheck();

  // Wait for dictionary to load
  await page.waitForTimeout(2000);

  // Step 3: Click letters to form a nonsense word "XAXA"
  await enterLetters(page, [0, 3, 0, 3]); // X A X A

  // Wait for validation
  await page.waitForTimeout(2000);

  // Step 4: The checkmark button should NOT appear
  const checkmarkButton = page.locator('.next-word-button');
  await expect(checkmarkButton).not.toBeVisible();
});

test('we can backspace to get a word', async ({ page }) => {
  const solveModeCheckbox = page.locator('#playMode');
  const playerSolutionContainer = page.locator('.player-solution-container');

  // Using the puzzle: N U O (top: 0-2), E R T (right: 3-5), Y I A (bottom: 6-8), L C P (left: 9-11)
  await enterPuzzle(page, ['N', 'U', 'O', 'E', 'R', 'T', 'Y', 'I', 'A', 'L', 'C', 'P']);

  // Switch to play mode
  await solveModeCheckbox.uncheck();

  // Wait for dictionary
  await page.waitForTimeout(100);

  await enterLetters(page, [0, 3, 8, 4, 9, 6]); // NEARLY
  // Wait for validation
  await page.waitForTimeout(500);

  const backspaceButton = page.locator('.backspace-button');

  await expect((playerSolutionContainer.locator('.word')).nth(0)).toHaveText('NEARLY');
  await expect(page.locator('.next-word-button')).toBeVisible();

  // Click backspace
  await backspaceButton.click();
  await page.waitForTimeout(2000);

  // Not a word, so no checkmark
  await expect((playerSolutionContainer.locator('.word')).nth(0)).toHaveText('NEARL');
  await expect(page.locator('.next-word-button')).not.toBeVisible();

  // Click backspace
  await backspaceButton.click();
  await page.waitForTimeout(2000);

  // Word should be advanceable
  await expect((playerSolutionContainer.locator('.word')).nth(0)).toHaveText('NEAR');
  await expect(page.locator('.next-word-button')).toBeVisible();
});
