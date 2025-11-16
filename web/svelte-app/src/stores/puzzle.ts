import { writable, derived, get, type Writable } from 'svelte/store';

// Type definitions for player solutions
// Word: array of letter indices (0-11 corresponding to puzzle positions)
export type Word = number[];

// PlayerSolution: array of words that form a complete solution
export type PlayerSolution = Word[];

// Puzzle fields store - array of 12 individual letters
// Layout: [0-2: top, 3-5: right, 6-8: left, 9-11: bottom]
export const puzzleFields: Writable<string[]> = writable(Array(12).fill(''));

// Mode store - true for play mode, false for solve mode
export const playMode: Writable<boolean> = writable(true);

// Solutions store - array of solution strings
export const solutions: Writable<string[]> = writable([]);

// Player solution store - the user's current attempt at solving the puzzle
export const playerSolution: Writable<PlayerSolution> = writable([]);

// Solver state
export const solverReady: Writable<boolean> = writable(false);
export const solving: Writable<boolean> = writable(false);
export const solveTime: Writable<number | null> = writable(null);

// Derived store - check if puzzle is complete
export const isPuzzleComplete = derived(
  puzzleFields,
  ($fields) => $fields.every(field => field.length === 1 && /^[A-Z]$/.test(field))
);

// Flag to control auto-saving
let autoSaveEnabled = false;

interface SavedPuzzle {
  fields: string[];
  playerSolution?: PlayerSolution;
}

// Load puzzle from localStorage
export function loadPuzzleFromStorage(): void {
  try {
    const saved = localStorage.getItem('letterBoxedPuzzle');
    if (saved) {
      const puzzle = JSON.parse(saved) as SavedPuzzle;
      if (puzzle.fields && Array.isArray(puzzle.fields) && puzzle.fields.length === 12) {
        puzzleFields.set(puzzle.fields);
        // Restore player solution if it exists, otherwise use empty array
        if (puzzle.playerSolution && Array.isArray(puzzle.playerSolution)) {
          playerSolution.set(puzzle.playerSolution as PlayerSolution);
        } else {
          playerSolution.set([[]] as PlayerSolution);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load saved puzzle:', error);
  } finally {
    // Enable auto-save after loading is complete
    autoSaveEnabled = true;
  }
}

// Set play mode (called when a puzzle is loaded from selection)
export function setPlayMode(): void {
  playMode.set(true);
}

// Set solve mode
export function setSolveMode(): void {
  playMode.set(false);
}

// Append a letter index to the current word (last word in player solution)
// Only works in play mode
export function appendLetterToPlayerSolution(letterIndex: number): void {
  // Only work in play mode
  if (!get(playMode)) return;

  // Validate index is in range 0-11
  if (letterIndex < 0 || letterIndex > 11) return;

  playerSolution.update(solution => {
    if ((!Array.isArray(solution))) {
      solution = [[] as Word] as PlayerSolution;
    }

    // Append to last word
    const lastWord = solution[solution.length - 1] ?? [] as Word;
    lastWord.push(letterIndex);
    return [...solution.slice(0, -1), lastWord];
  });
}

// Remove the last letter from the player solution (backspace)
// Only works in play mode
export function backspacePlayerSolution(): void {
  // Only work in play mode
  if (!get(playMode)) return;

  playerSolution.update(solution => {
    if (!Array.isArray(solution) || solution.length === 0) {
      return solution;
    }

    // Get the last word
    const lastWord = solution[solution.length - 1];
    if (!lastWord || lastWord.length === 0) {
      // If last word is empty, remove it
      return solution.slice(0, -1);
    }

    // Remove last letter from last word
    const newLastWord = lastWord.slice(0, -1);

    // If the word is now empty, remove it entirely
    if (newLastWord.length === 0) {
      return solution.slice(0, -1);
    }

    // Otherwise, update with the shortened word
    return [...solution.slice(0, -1), newLastWord];
  });
}

// Save puzzle to localStorage
function savePuzzleToStorage(): void {
  try {
    const puzzle: SavedPuzzle = {
      fields: get(puzzleFields),
      playerSolution: get(playerSolution)
    };

    localStorage.setItem('letterBoxedPuzzle', JSON.stringify(puzzle));
  } catch (error) {
    console.warn('Failed to save puzzle:', error);
  }
}

// Track previous puzzle fields to detect changes
let previousFields: string[] = [];

// Subscribe to puzzle field changes
puzzleFields.subscribe(fields => {
  if (autoSaveEnabled) {
    // Check if the puzzle actually changed (not just a reference update)
    const puzzleChanged = previousFields.length > 0 &&
      (previousFields.length !== fields.length ||
        previousFields.some((val, idx) => val !== fields[idx]));

    if (puzzleChanged) {
      // Reset player solution when puzzle changes
      playerSolution.set([]);
    }

    previousFields = [...fields];
    savePuzzleToStorage();
  }
});

// Subscribe to player solution changes
playerSolution.subscribe(() => {
  if (autoSaveEnabled) {
    savePuzzleToStorage();
  }
});
