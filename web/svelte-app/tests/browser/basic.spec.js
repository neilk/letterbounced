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

test('page loads successfully', async ({ page }) => {

  // Check that the page title is set
  await expect(page).toHaveTitle(/Letter/);

  // Verify the page is visible and rendered
  const body = page.locator('body');
  await expect(body).toBeVisible();
});

test('letter box is present', async ({ page }) => {
  // Check that letter input fields are present (should be 12 fields)
  const inputs = getLetterInputs(page);
  await expect(inputs).toHaveCount(12);
});

test('solve a puzzle', async ({ page }) => {

  await enterPuzzle(page, ['N', 'U', 'O', 'E', 'R', 'T', 'Y', 'I', 'A', 'L', 'C', 'P']);
  // The shortest solution: "neurotypical"
  const solutionText = page.locator('text=/neurotypical/i');
  await expect(solutionText).toBeVisible({ timeout: 10000 });
});

test('puzzle with no solutions', async ({ page }) => {

  // Enter a puzzle with no solutions - it has no vowels
  await enterPuzzle(page, ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P']);

  // Wait for solving to complete and check for the "No solutions found!" message
  const noSolutionsMessage = page.locator('text=/No solutions found!/i');
  await expect(noSolutionsMessage).toBeVisible({ timeout: 10000 });
});

test('solve mode allows editing, play mode prevents editing', async ({ page }) => {
  const inputs = getLetterInputs(page);
  const firstInput = inputs.nth(0);
  const solveModeCheckbox = page.locator('#playMode');

  // Play mode should be active by default (checkbox unchecked)
  await expect(solveModeCheckbox).not.toBeChecked();

  // Verify input is readonly in play mode
  await expect(firstInput).toHaveAttribute('readonly', '');

  // Switch to solve mode by checking the checkbox
  await solveModeCheckbox.check();
  await expect(solveModeCheckbox).toBeChecked();

  // Verify input is NOT readonly in solve mode
  await expect(firstInput).not.toHaveAttribute('readonly');

  // Verify we can edit in solve mode
  await firstInput.fill('A');
  await expect(firstInput).toHaveValue('A');

  // Switch to play mode by unchecking the solve mode checkbox
  await solveModeCheckbox.uncheck();
  await expect(solveModeCheckbox).not.toBeChecked();

  // Verify input is readonly in play mode (Playwright won't fill readonly inputs)
  await expect(firstInput).toHaveAttribute('readonly', '');

  // The value should remain unchanged in play mode
  await expect(firstInput).toHaveValue('A');

  // Switch back to solve mode by checking the checkbox
  await solveModeCheckbox.check();
  await expect(solveModeCheckbox).toBeChecked();

  // Verify input is no longer readonly
  await expect(firstInput).not.toHaveAttribute('readonly');

  // Verify we can edit again in solve mode
  await firstInput.fill('C');
  await expect(firstInput).toHaveValue('C');
});

test('text selection behavior differs between play and solve modes', async ({ page }) => {
  const inputs = getLetterInputs(page);
  const solveModeCheckbox = page.locator('#playMode');

  // Switch to solve mode and add content to a field
  await solveModeCheckbox.check();
  const firstInput = inputs.nth(0);
  await firstInput.fill('A');
  await expect(firstInput).toHaveValue('A');

  // Switch to play mode
  await solveModeCheckbox.uncheck();
  await expect(solveModeCheckbox).not.toBeChecked();

  // Click the field with content in play mode
  await firstInput.click();

  // Verify text is NOT selected in play mode
  const notSelected = await firstInput.evaluate((el) => {
    return el.selectionStart === el.selectionEnd;
  });
  expect(notSelected).toBe(true);

  // Switch to solve mode
  await solveModeCheckbox.check();
  await expect(solveModeCheckbox).toBeChecked();

  // Click the field with content in solve mode
  await firstInput.click();

  // Verify text IS selected in solve mode (entire content selected)
  const isSelected = await firstInput.evaluate((el) => {
    return el.selectionStart === 0 && el.selectionEnd === el.value.length;
  });
  expect(isSelected).toBe(true);

  // Also test focus behavior in solve mode
  const secondInput = inputs.nth(1);
  await secondInput.fill('B');
  await secondInput.focus();

  // Verify text IS selected on focus in solve mode
  const isFocusSelected = await secondInput.evaluate((el) => {
    return el.selectionStart === 0 && el.selectionEnd === el.value.length;
  });
  expect(isFocusSelected).toBe(true);

  // Fill third input while in solve mode
  const thirdInput = inputs.nth(2);
  await thirdInput.fill('C');

  // Switch back to play mode and test focus
  await solveModeCheckbox.uncheck();
  await thirdInput.focus();

  // Verify text is NOT selected on focus in play mode
  const notFocusSelected = await thirdInput.evaluate((el) => {
    return el.selectionStart === el.selectionEnd;
  });
  expect(notFocusSelected).toBe(true);
});

test('solutions hidden in play mode, visible in solve mode', async ({ page }) => {
  const solveModeCheckbox = page.locator('#playMode');
  const solutionsContainer = page.locator('.solutions-container');

  // Enter a puzzle in solve mode
  await enterPuzzle(page, ['N', 'U', 'O', 'E', 'R', 'T', 'Y', 'I', 'A', 'L', 'C', 'P']);

  // Wait for solutions to be generated (in solve mode)
  await page.waitForSelector('.solution-item', { timeout: 10000 });

  // Verify solutions container is visible in solve mode
  await expect(solutionsContainer).toBeVisible();

  // Verify solution items are visible in solve mode
  const solutionItems = page.locator('.solution-item');
  await expect(solutionItems.first()).toBeVisible();

  // Switch to play mode
  await solveModeCheckbox.uncheck();
  await expect(solveModeCheckbox).not.toBeChecked();

  // Verify solutions container is hidden (display: none) in play mode
  await expect(solutionsContainer).toBeHidden();

  // Switch back to solve mode
  await solveModeCheckbox.check();
  await expect(solveModeCheckbox).toBeChecked();

  // Verify solutions container is visible again in solve mode
  await expect(solutionsContainer).toBeVisible();
  await expect(solutionItems.first()).toBeVisible();
});

test('player solution displays clicked letters in play mode', async ({ page }) => {
  const solveModeCheckbox = page.locator('#playMode');
  const inputs = getLetterInputs(page);
  const playerSolutionContainer = page.locator('.player-solution-container');

  // Enter a puzzle in solve mode
  // Using the puzzle: N U O (top), E R T (right), Y I A (bottom), L C P (left)
  await enterPuzzle(page, ['N', 'U', 'O', 'E', 'R', 'T', 'Y', 'I', 'A', 'L', 'C', 'P']);

  // Switch to play mode
  await solveModeCheckbox.uncheck();
  await expect(solveModeCheckbox).not.toBeChecked();

  // Verify player solution container is visible in play mode
  await expect(playerSolutionContainer).toBeVisible();

  // Verify initial state shows placeholder message
  await expect(playerSolutionContainer).toContainText(/Click letters to start/i);

  // Click letters to form a word: N(0) -> E(3) -> U(1) -> R(4) -> A(8) -> L(9)
  // This spells "NEURAL"
  await inputs.nth(0).click();  // N
  await page.waitForTimeout(100); // Small delay to ensure state updates
  await expect(playerSolutionContainer).toContainText('N');

  await inputs.nth(3).click();  // E
  await page.waitForTimeout(100);
  await expect(playerSolutionContainer).toContainText('NE');

  await inputs.nth(1).click();  // U
  await page.waitForTimeout(100);
  await expect(playerSolutionContainer).toContainText('NEU');

  await inputs.nth(4).click();  // R
  await page.waitForTimeout(100);
  await expect(playerSolutionContainer).toContainText('NEUR');

  await inputs.nth(8).click();  // A
  await page.waitForTimeout(100);
  await expect(playerSolutionContainer).toContainText('NEURA');

  await inputs.nth(9).click();  // L
  await page.waitForTimeout(100);
  await expect(playerSolutionContainer).toContainText('NEURAL');

  // Verify the full word is displayed
  const wordSpan = playerSolutionContainer.locator('.word');
  await expect(wordSpan).toHaveText('NEURAL');

  // Verify placeholder message is no longer visible
  await expect(playerSolutionContainer).not.toContainText(/Click letters to start/i);
});

test('backspace button removes letters in play mode', async ({ page }) => {
  const solveModeCheckbox = page.locator('#playMode');
  const inputs = getLetterInputs(page);
  const playerSolutionContainer = page.locator('.player-solution-wrapper');
  const backspaceButton = page.locator('.backspace-button');

  // Enter a puzzle in solve mode
  await enterPuzzle(page, ['N', 'U', 'O', 'E', 'R', 'T', 'Y', 'I', 'A', 'L', 'C', 'P']);

  // Switch to play mode
  await solveModeCheckbox.uncheck();
  await expect(solveModeCheckbox).not.toBeChecked();

  // Verify backspace button is not visible initially (no content)
  await expect(backspaceButton).not.toBeVisible();

  // Click two letters: N(0) -> E(3)
  await inputs.nth(0).click();  // N
  await page.waitForTimeout(100);
  await expect(playerSolutionContainer).toContainText('N');

  // Verify backspace button is now visible
  await expect(backspaceButton).toBeVisible();

  await inputs.nth(3).click();  // E
  await page.waitForTimeout(100);
  await expect(playerSolutionContainer).toContainText('NE');

  // Verify the full content
  const wordSpan = playerSolutionContainer.locator('.word');
  await expect(wordSpan).toHaveText('NE');

  // Click backspace once
  await backspaceButton.click();
  await page.waitForTimeout(100);

  // Verify final letter was removed, should show "N"
  await expect(wordSpan).toHaveText('N');
  await expect(playerSolutionContainer).toContainText('N');
  await expect(playerSolutionContainer).not.toContainText('NE');

  // Backspace button should still be visible
  await expect(backspaceButton).toBeVisible();

  // Click backspace again
  await backspaceButton.click();
  await page.waitForTimeout(100);

  // Verify it's now blank - should show placeholder message
  await expect(playerSolutionContainer).toContainText(/Click letters to start/i);

  // Backspace button should no longer be visible
  await expect(backspaceButton).not.toBeVisible();
});


