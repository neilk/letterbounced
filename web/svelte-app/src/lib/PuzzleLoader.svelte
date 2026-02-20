<script lang="ts">
  import { puzzleFields } from '../stores/puzzle';

  interface ExamplePuzzle {
    label: string;
    value: string;
  }

  let loading: boolean = false;

  const NYT_TODAY_VALUE: string = '__NYT_TODAY__';

  const examplePuzzles: ExamplePuzzle[] = [
    { label: 'Sample: JGH NVY EID ORP', value: 'JGHNVYEIDORP' },
    { label: 'Sample: YFA OTK LGW RNI', value: 'YFAOTKLGWRNI' },
    { label: 'Sample: LHM CIB ANK OUP', value: 'LHMCIBANKOUP' },
    { label: 'Sample: GIY ERC XHA LOP', value: 'GIYERCXHALOP' },
    { label: 'Sample: PRC YAN LKH SIO', value: 'PRCYANLKHSIO' },
    { label: 'Sample: VYQ FIG OTE XLU', value: 'VYQFIGOTEXLU' }
  ];

  async function loadTodaysPuzzle(): Promise<void> {
    loading = true;
    try {
      const today: string = new Date().toLocaleDateString('en-CA');
      let response: Response = await fetch(`./puzzles/${today}.json`);

      if (response.status === 404) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr: string = yesterday.toLocaleDateString('en-CA');
        response = await fetch(`./puzzles/${yesterdayStr}.json`);
      }

      if (!response.ok) {
        alert("Today's puzzle is not available yet. Please try again later.");
        return;
      }

      const data = await response.json() as { sides: string[] };
      const fields: string[] = data.sides.flatMap((side: string) => side.split(''));
      puzzleFields.set(fields);
    } catch (error) {
      const message: string = error instanceof Error ? error.message : 'Unknown error';
      alert("Failed to load today's puzzle: " + message);
    } finally {
      loading = false;
    }
  }

  async function handlePuzzleSelection(event: Event): Promise<void> {
    const target = event.target as HTMLSelectElement;
    const value: string = target.value;
    if (!value) return;

    // Check if NYT Today was selected
    if (value === NYT_TODAY_VALUE) {
      await loadTodaysPuzzle();
    } else {
      // Convert string of 12 letters to array
      const fields: string[] = value.split('');

      // Update puzzle store (effect in LetterBox will handle display and animation)
      puzzleFields.set(fields);
    }

    // Reset dropdown
    setTimeout(() => {
      target.value = '';
    }, 100);
  }
</script>

<div class="puzzle-loader">
  <span class="puzzle-loader-label">Enter a puzzle, or</span>
  <div class="pill-select-wrapper">
    <select class="pill-select" on:change={handlePuzzleSelection} disabled={loading}>
      <option value="">{loading ? 'Loading...' : 'choose a puzzle'}</option>
      <option value={NYT_TODAY_VALUE}>Today's New York Times</option>
      {#each examplePuzzles as puzzle}
        <option value={puzzle.value}>{puzzle.label}</option>
      {/each}
    </select>
  </div>
</div>

<style>
  .puzzle-loader {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin: 20px 0;
  }

  .puzzle-loader-label {
    font-weight: 600;
    color: var(--color-text);
  }

  .pill-select-wrapper {
    position: relative;
    display: inline-block;
  }

  .pill-select {
    background: var(--color-primary);
    color: white;
    border: none;
    padding: 10px 35px 10px 20px;
    border-radius: 20px;
    font-size: 14px;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    transition: background 0.2s;
  }

  .pill-select:hover:not(:disabled) {
    background: var(--color-primary-hover);
  }

  .pill-select:disabled {
    background: var(--color-disabled);
    cursor: not-allowed;
  }

  .pill-select-wrapper::after {
    content: '▼';
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: white;
    font-size: 10px;
  }

  @media (max-width: 600px) {
    .puzzle-loader {
      flex-direction: column;
      gap: 8px;
    }
  }
</style>
