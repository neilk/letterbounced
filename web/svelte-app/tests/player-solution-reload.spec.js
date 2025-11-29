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

async function selectPuzzleFromDropdown(page, puzzleLabel) {
  const dropdown = page.locator('.pill-select');
  await dropdown.selectOption({ label: puzzleLabel });
  // Wait a bit for the puzzle to load
  await page.waitForTimeout(200);
}

test('player solution clears when loading new puzzle after page reload', async ({ page, context }) => {
  const solveModeCheckbox = page.locator('#playMode');
  const inputs = getLetterInputs(page);
  const playerSolutionContainer = page.locator('.player-solution-container');

  // Step 1: Enter first puzzle in solve mode
  // Using the puzzle: N U O (top), E R T (right), Y I A (bottom), L C P (left)
  await enterPuzzle(page, ['N', 'U', 'O', 'E', 'R', 'T', 'Y', 'I', 'A', 'L', 'C', 'P']);

  // Step 2: Switch to play mode
  await solveModeCheckbox.uncheck();
  await expect(solveModeCheckbox).not.toBeChecked();

  // Step 3: Click letters to form a player solution
  // Click letters to form "NEURAL": N(0) -> E(3) -> U(1) -> R(4) -> A(8) -> L(9)
  await inputs.nth(0).click();  // N
  await page.waitForTimeout(100);
  await inputs.nth(3).click();  // E
  await page.waitForTimeout(100);
  await inputs.nth(1).click();  // U
  await page.waitForTimeout(100);
  await inputs.nth(4).click();  // R
  await page.waitForTimeout(100);
  await inputs.nth(8).click();  // A
  await page.waitForTimeout(100);
  await inputs.nth(9).click();  // L
  await page.waitForTimeout(100);

  // Verify the solution is "NEURAL"
  const wordSpan = playerSolutionContainer.locator('.word');
  await expect(wordSpan).toHaveText('NEURAL');

  // Step 4: Reload the page (this should restore both puzzle and player solution)
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // Wait for animation and state restoration

  // Verify the puzzle was restored (check first few letters)
  const inputsAfterReload = getLetterInputs(page);
  await expect(inputsAfterReload.nth(0)).toHaveValue('N');
  await expect(inputsAfterReload.nth(1)).toHaveValue('U');
  await expect(inputsAfterReload.nth(2)).toHaveValue('O');

  // Verify player solution was restored
  const wordSpanAfterReload = page.locator('.player-solution-container .word');
  await expect(wordSpanAfterReload).toHaveText('NEURAL');

  // Step 5: Load a DIFFERENT puzzle from the dropdown
  // This is the critical step - loading a new puzzle should clear the old playerSolution
  await selectPuzzleFromDropdown(page, 'Sample: JGH NVY EID ORP');

  // Wait for puzzle to fully load
  await page.waitForTimeout(500);

  // Verify the new puzzle is loaded (check first few letters should be J, G, H)
  const inputsAfterNewPuzzle = getLetterInputs(page);
  await expect(inputsAfterNewPuzzle.nth(0)).toHaveValue('J');
  await expect(inputsAfterNewPuzzle.nth(1)).toHaveValue('G');
  await expect(inputsAfterNewPuzzle.nth(2)).toHaveValue('H');

  // Step 6: THE BUG CHECK
  // The player solution should be CLEARED because we loaded a new puzzle
  // It should NOT show letters from the new puzzle at the old indices
  const playerSolutionAfterNewPuzzle = page.locator('.player-solution-container');

  // Should show the placeholder message (empty player solution)
  // If the bug exists, it will show "JNGVIO" (the new puzzle's letters at the old indices 0,3,1,4,8,9)
  //   New puzzle layout: J G H (0-2), N V Y (3-5), E I D (6-8), O R P (9-11)
  //   Old indices [0,3,1,4,8,9] -> J,N,G,V,I,O = "JNGVIO"
  // If the bug is fixed, it should show the placeholder message
  await expect(playerSolutionAfterNewPuzzle).toContainText(/Click letters to start/i);

  // Verify no word span is showing stale data
  const wordSpanAfterNewPuzzle = playerSolutionAfterNewPuzzle.locator('.word');
  const wordSpanVisible = await wordSpanAfterNewPuzzle.isVisible();

  if (wordSpanVisible) {
    const wordText = await wordSpanAfterNewPuzzle.textContent();
    // The word should not be showing the stale indices
    expect(wordText).not.toBe('JNGVIO');
    expect(wordText).not.toBe('NEURAL');
  }
});
