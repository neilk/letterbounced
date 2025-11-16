import { writable, derived, type Writable } from 'svelte/store';

// Puzzle fields store - array of 12 individual letters
// Layout: [0-2: top, 3-5: right, 6-8: left, 9-11: bottom]
export const puzzleFields: Writable<string[]> = writable(Array(12).fill(''));

// Mode store - true for play mode, false for edit mode
export const playMode: Writable<boolean> = writable(true);

// Solutions store - array of solution strings
export const solutions: Writable<string[]> = writable([]);

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
}

// Load puzzle from localStorage
export function loadPuzzleFromStorage(): void {
  try {
    const saved = localStorage.getItem('letterBoxedPuzzle');
    if (saved) {
      const puzzle = JSON.parse(saved) as SavedPuzzle;
      if (puzzle.fields && Array.isArray(puzzle.fields) && puzzle.fields.length === 12) {
        puzzleFields.set(puzzle.fields);
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

// Set edit mode
export function setEditMode(): void {
  playMode.set(false);
}

// Save puzzle to localStorage
export function savePuzzleToStorage(fields: string[]): void {
  try {
    localStorage.setItem('letterBoxedPuzzle', JSON.stringify({ fields }));
  } catch (error) {
    console.warn('Failed to save puzzle:', error);
  }
}

// Subscribe to save changes automatically (only after initial load)
puzzleFields.subscribe(fields => {
  if (autoSaveEnabled) {
    savePuzzleToStorage(fields);
  }
});
