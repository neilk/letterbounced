import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  puzzleFields,
  playerSolution,
  playMode,
  appendableFields,
  loadPuzzle,
  updatePuzzleField,
  setPlayMode,
  setSolveMode,
  appendLetterToPlayerSolution,
  backspacePlayerSolution,
} from '../../src/stores/puzzle';

describe('puzzle store', () => {
  beforeEach(() => {
    // Reset to clean state before each test
    loadPuzzle(Array(12).fill(''));
    setSolveMode();
  });

  describe('loadPuzzle', () => {
    it('should load puzzle fields', () => {
      const testFields = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
      loadPuzzle(testFields);
      expect(get(puzzleFields)).toEqual(testFields);
    });

    it('should clear player solution when loading new puzzle', () => {
      setPlayMode();
      appendLetterToPlayerSolution(0);
      expect(get(playerSolution)).toHaveLength(1);

      loadPuzzle(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
      expect(get(playerSolution)).toEqual([]);
    });
  });

  describe('updatePuzzleField', () => {
    it('should update a single field', () => {
      updatePuzzleField(0, 'X');
      expect(get(puzzleFields)[0]).toBe('X');
    });

    it('should clear player solution when editing puzzle', () => {
      setPlayMode();
      loadPuzzle(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
      appendLetterToPlayerSolution(0);
      expect(get(playerSolution)).toHaveLength(1);

      updatePuzzleField(0, 'Z');
      expect(get(playerSolution)).toEqual([]);
    });
  });

  describe('playMode', () => {
    it('should be in solve mode after beforeEach reset', () => {
      expect(get(playMode)).toBe(false);
    });

    it('should toggle between play and solve modes', () => {
      setPlayMode();
      expect(get(playMode)).toBe(true);

      setSolveMode();
      expect(get(playMode)).toBe(false);

      setPlayMode();
      expect(get(playMode)).toBe(true);
    });
  });

  describe('appendableFields', () => {
    beforeEach(() => {
      loadPuzzle(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
      setPlayMode();
    });

    it('should mark all fields as appendable when no solution exists', () => {
      const fields = get(appendableFields);
      expect(fields).toEqual(Array(12).fill(true));
    });

    it('should mark fields on same side as not appendable after first letter', () => {
      // Append letter at index 0 (top side: 0,1,2)
      appendLetterToPlayerSolution(0);

      const fields = get(appendableFields);

      // Same side (0,1,2) should not be appendable
      expect(fields[0]).toBe(false);
      expect(fields[1]).toBe(false);
      expect(fields[2]).toBe(false);

      // Other sides should be appendable
      expect(fields[3]).toBe(true);  // Right side
      expect(fields[6]).toBe(true);  // Bottom side
      expect(fields[9]).toBe(true);  // Left side
    });

    it('should update appendable fields after each letter', () => {
      // Add letter from top side (index 0)
      appendLetterToPlayerSolution(0);
      expect(get(appendableFields)[0]).toBe(false);
      expect(get(appendableFields)[3]).toBe(true);

      // Add letter from right side (index 3)
      appendLetterToPlayerSolution(3);
      expect(get(appendableFields)[3]).toBe(false);
      expect(get(appendableFields)[6]).toBe(true);
    });

    it('should mark all fields as appendable in solve mode', () => {
      appendLetterToPlayerSolution(0);
      setSolveMode();

      const fields = get(appendableFields);
      expect(fields).toEqual(Array(12).fill(true));
    });
  });

  describe('appendLetterToPlayerSolution', () => {
    beforeEach(() => {
      loadPuzzle(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
      setPlayMode();
    });

    it('should append first letter to empty solution', () => {
      appendLetterToPlayerSolution(0);
      expect(get(playerSolution)).toEqual([[0]]);
    });

    it('should append letters to current word', () => {
      appendLetterToPlayerSolution(0);  // Top side
      appendLetterToPlayerSolution(3);  // Right side
      appendLetterToPlayerSolution(6);  // Bottom side

      expect(get(playerSolution)).toEqual([[0, 3, 6]]);
    });

    it('should throw error when appending from same side', () => {
      appendLetterToPlayerSolution(0);  // Top side (index 0)

      // Trying to append another letter from top side (index 1) should throw
      expect(() => appendLetterToPlayerSolution(1)).toThrow('not appendable');
    });

    it('should throw error for out of range index', () => {
      expect(() => appendLetterToPlayerSolution(-1)).toThrow('out of range');
      expect(() => appendLetterToPlayerSolution(12)).toThrow('out of range');
    });

    it('should not append in solve mode', () => {
      setSolveMode();
      appendLetterToPlayerSolution(0);
      expect(get(playerSolution)).toEqual([]);
    });
  });

  describe('backspacePlayerSolution', () => {
    beforeEach(() => {
      loadPuzzle(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']);
      setPlayMode();
    });

    it('should remove last letter from word', () => {
      appendLetterToPlayerSolution(0);
      appendLetterToPlayerSolution(3);
      expect(get(playerSolution)).toEqual([[0, 3]]);

      backspacePlayerSolution();
      expect(get(playerSolution)).toEqual([[0]]);
    });

    it('should remove word when last letter is removed', () => {
      appendLetterToPlayerSolution(0);
      expect(get(playerSolution)).toEqual([[0]]);

      backspacePlayerSolution();
      expect(get(playerSolution)).toEqual([]);
    });

    it('should do nothing when solution is empty', () => {
      backspacePlayerSolution();
      expect(get(playerSolution)).toEqual([]);
    });

    it('should not work in solve mode', () => {
      appendLetterToPlayerSolution(0);
      setSolveMode();

      backspacePlayerSolution();
      expect(get(playerSolution)).toEqual([[0]]);
    });
  });
});
