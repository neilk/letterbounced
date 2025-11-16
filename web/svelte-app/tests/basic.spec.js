import { expect, test } from './fixture';

function getLetterInputs(page) {
  return page.locator('.letter-box-container input[type="text"]');
}

async function enterPuzzle(page, letters) {
  // Switch to edit mode first to enable editing
  const editModeCheckbox = page.locator('#playMode');
  await editModeCheckbox.check();

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

test('edit mode allows editing, play mode prevents editing', async ({ page }) => {
  const inputs = getLetterInputs(page);
  const firstInput = inputs.nth(0);
  const editModeCheckbox = page.locator('#playMode');

  // Play mode should be active by default (checkbox unchecked)
  await expect(editModeCheckbox).not.toBeChecked();

  // Verify input is readonly in play mode
  await expect(firstInput).toHaveAttribute('readonly', '');

  // Switch to edit mode by checking the checkbox
  await editModeCheckbox.check();
  await expect(editModeCheckbox).toBeChecked();

  // Verify input is NOT readonly in edit mode
  await expect(firstInput).not.toHaveAttribute('readonly');

  // Verify we can edit in edit mode
  await firstInput.fill('A');
  await expect(firstInput).toHaveValue('A');

  // Switch to play mode by unchecking the edit mode checkbox
  await editModeCheckbox.uncheck();
  await expect(editModeCheckbox).not.toBeChecked();

  // Verify input is readonly in play mode (Playwright won't fill readonly inputs)
  await expect(firstInput).toHaveAttribute('readonly', '');

  // The value should remain unchanged in play mode
  await expect(firstInput).toHaveValue('A');

  // Switch back to edit mode by checking the checkbox
  await editModeCheckbox.check();
  await expect(editModeCheckbox).toBeChecked();

  // Verify input is no longer readonly
  await expect(firstInput).not.toHaveAttribute('readonly');

  // Verify we can edit again in edit mode
  await firstInput.fill('C');
  await expect(firstInput).toHaveValue('C');
});


