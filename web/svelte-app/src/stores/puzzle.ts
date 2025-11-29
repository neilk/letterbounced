import { writable, derived, get, type Writable } from 'svelte/store';

// Type definitions for player solutions
// Word: array of letter indices (0-11 corresponding to puzzle positions)
export type Word = number[];

// PlayerSolution: array of words that form a complete solution
export type PlayerSolution = Word[];

// Combined puzzle state
interface PuzzleState {
  fields: string[];
  playerSolution: PlayerSolution;
}

// Load initial state from localStorage (runs once at module load)
function loadInitialState(): PuzzleState {
  try {
    const saved = localStorage.getItem('letterBoxedPuzzle');
    if (saved) {
      const puzzle = JSON.parse(saved);
      if (puzzle.fields && Array.isArray(puzzle.fields) && puzzle.fields.length === 12) {
        return {
          fields: puzzle.fields,
          playerSolution: puzzle.playerSolution || []
        };
      }
    }
  } catch (error) {
    console.warn('Failed to load saved puzzle:', error);
  }
  // Default state
  return {
    fields: Array(12).fill(''),
    playerSolution: []
  };
}

// Single source of truth - atomic puzzle state
const puzzleState = writable<PuzzleState>(loadInitialState());

// Derived stores for component access
export const puzzleFields = derived(puzzleState, $state => $state.fields);
export const playerSolution = derived(puzzleState, $state => $state.playerSolution);

// Mode store - true for play mode, false for solve mode
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

// Subscribe to state changes and save to localStorage
puzzleState.subscribe(state => {
  try {
    localStorage.setItem('letterBoxedPuzzle', JSON.stringify(state));
  } catch (error) {
    console.warn('Failed to save puzzle:', error);
  }
});

// Load a new puzzle (clears player solution)
export function loadPuzzle(fields: string[]): void {
  puzzleState.set({
    fields,
    playerSolution: []
  });
}

// Update a single puzzle field (clears player solution)
export function updatePuzzleField(index: number, letter: string): void {
  puzzleState.update(state => ({
    fields: state.fields.map((f, i) => i === index ? letter : f),
    playerSolution: []  // Clear solution when puzzle is edited
  }));
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

  puzzleState.update(state => {
    let solution = state.playerSolution;
    if (!Array.isArray(solution)) {
      solution = [[] as Word] as PlayerSolution;
    }

    // Append to last word
    const lastWord = solution[solution.length - 1] ?? [] as Word;
    const updatedLastWord = [...lastWord, letterIndex];
    const updatedSolution = [...solution.slice(0, -1), updatedLastWord];

    return {
      ...state,
      playerSolution: updatedSolution
    };
  });
}

// Remove the last letter from the player solution (backspace)
// Only works in play mode
export function backspacePlayerSolution(): void {
  // Only work in play mode
  if (!get(playMode)) return;

  puzzleState.update(state => {
    const solution = state.playerSolution;
    if (!Array.isArray(solution) || solution.length === 0) {
      return state;
    }

    // Get the last word
    const lastWord = solution[solution.length - 1];
    if (!lastWord || lastWord.length === 0) {
      // If last word is empty, remove it
      return {
        ...state,
        playerSolution: solution.slice(0, -1)
      };
    }

    // Remove last letter from last word
    const newLastWord = lastWord.slice(0, -1);

    // If the word is now empty, remove it entirely
    if (newLastWord.length === 0) {
      return {
        ...state,
        playerSolution: solution.slice(0, -1)
      };
    }

    // Otherwise, update with the shortened word
    return {
      ...state,
      playerSolution: [...solution.slice(0, -1), newLastWord]
    };
  });
}
