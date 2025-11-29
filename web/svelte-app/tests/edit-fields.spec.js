import { expect, test } from './fixture';

function getLetterInputs(page) {
  return page.locator('.letter-box-container input[type="text"]');
}

test('fields are editable in solve mode', async ({ page }) => {
  const solveModeCheckbox = page.locator('#playMode');
  const inputs = getLetterInputs(page);

  // Switch to solve mode (checkbox checked)
  await solveModeCheckbox.check();
  await expect(solveModeCheckbox).toBeChecked();

  // Try to edit the first field
  const firstInput = inputs.nth(0);
  await firstInput.click();
  await firstInput.fill('A');

  // Verify the value was set
  await expect(firstInput).toHaveValue('A');

  // Try to edit the second field
  const secondInput = inputs.nth(1);
  await secondInput.click();
  await secondInput.fill('B');

  // Verify the value was set
  await expect(secondInput).toHaveValue('B');

  // Try to change the first field
  await firstInput.click();
  await firstInput.fill('C');

  // Verify the value was changed
  await expect(firstInput).toHaveValue('C');
});

test('can fill entire puzzle in solve mode', async ({ page }) => {
  const solveModeCheckbox = page.locator('#playMode');
  const inputs = getLetterInputs(page);

  // Switch to solve mode
  await solveModeCheckbox.check();

  // Fill all 12 fields
  const letters = ['J', 'G', 'H', 'N', 'V', 'Y', 'E', 'I', 'D', 'O', 'R', 'P'];
  for (let i = 0; i < 12; i++) {
    await inputs.nth(i).fill(letters[i]);
  }

  // Verify all fields have correct values
  for (let i = 0; i < 12; i++) {
    await expect(inputs.nth(i)).toHaveValue(letters[i]);
  }
});
