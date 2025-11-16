<script lang="ts">
  import { onMount } from 'svelte';
  import PuzzleLoader from './lib/PuzzleLoader.svelte';
  import LetterBox from './lib/LetterBox.svelte';
  import SolutionsDisplay from './lib/SolutionsDisplay.svelte';
  import ErrorDisplay from './lib/ErrorDisplay.svelte';
  import PlayerSolution from './lib/PlayerSolution.svelte';
  import {
    puzzleFields,
    loadPuzzleFromStorage,
    playMode
  } from './stores/puzzle';
  import {
    initializeSolverWorker,
    solvePuzzle as workerSolvePuzzle,
    solutions,
    solverReady
  } from './stores/solver-worker';
  import { throttle } from './utils/throttle';

  let initError: string | null = null;

  onMount(async () => {
    // Load saved puzzle from localStorage
    loadPuzzleFromStorage();

    // Initialize solver worker with dictionary
    try {
      const response = await fetch('./dictionary.txt');
      const dictionaryText = await response.text();
      const dictionaryData = new TextEncoder().encode(dictionaryText);
      initializeSolverWorker(dictionaryData);
    } catch (error) {
      initError = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to initialize solver worker:', error);
    }
  });

  // Throttled solve function - only throttle the actual solving
  const throttledSolve = throttle((sides: string[]) => {
    workerSolvePuzzle(sides);
  }, 300);

  // Reactive statement: auto-solve when puzzle changes or solver becomes ready
  $: {
    if ($puzzleFields.every(f => f.length === 1 && /^[A-Z]$/.test(f))) {
      // Puzzle is complete
      if ($solverReady) {
        const sides = [
          $puzzleFields.slice(0, 3).join(''),   // top
          $puzzleFields.slice(3, 6).join(''),   // right
          $puzzleFields.slice(9, 12).join(''),  // bottom
          $puzzleFields.slice(6, 9).join('')    // left
        ].map(s => s.toLowerCase());

        throttledSolve(sides);
      }
    } else {
      // Puzzle is incomplete - clear solutions immediately (no throttle)
      solutions.set([]);
    }
  }
</script>

<main>
  <h1>Letter Bounced</h1>

  {#if initError}
    <div class="error">Failed to initialize solver: {initError}</div>
  {/if}

  <div class="example">
    <PuzzleLoader />
  </div>

  <div class="mode-toggle">
    <label class="mode-checkbox">
      <input
        type="checkbox"
        id="playMode"
        checked={!$playMode}
        on:change={(e) => playMode.set(!(e.target as HTMLInputElement).checked)}
      >
      <span>Solve Mode</span>
    </label>
  </div>

  <div class="container">
    <div class="game-input">
      <LetterBox playMode={$playMode} />
    </div>
  </div>

  <!-- Error display - always visible when there's an error -->
  <ErrorDisplay />

  <div class="container">
    <SolutionsDisplay playMode={$playMode} />
    <PlayerSolution playMode={$playMode} />
  </div>
</main>

<style>
  :global(body) {
    font-family: Arial, sans-serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    line-height: 1.6;
  }

  main {
    width: 100%;
  }

  h1 {
    font-size: 2rem;
    text-align: center;
  }

  .container {
    background: var(--color-bg-container);
    /* padding: 20px; */
    border-radius: 8px;
    /* margin: 20px 0; */
  }

  .example {
    /* background: var(--color-bg-example); */
    /* padding: 15px;
    border-radius: 4px; */
    margin: /*20px */ 0;
  }

  .game-input {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    margin: 0; /* 20px 0; */
  }

  .error {
    color: var(--color-error);
    background: var(--color-error-bg);
    padding: 10px;
    border-radius: 4px;
    margin: 10px 0;
  }

  .mode-toggle {
    display: flex;
    justify-content: center;
    margin: 20px 0;
  }

  .mode-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    user-select: none;
  }

  .mode-checkbox input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
  }

  .mode-checkbox:hover {
    color: var(--color-primary);
  }
</style>
