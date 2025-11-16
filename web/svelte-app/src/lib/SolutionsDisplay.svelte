<script lang="ts">
  import { solutions, solving } from '../stores/solver-worker';
  import { isPuzzleComplete } from '../stores/puzzle';

  // Props
  let { playMode = false } = $props<{ playMode?: boolean }>();

  interface ParsedSolution {
    words: string;
    score: string;
    length: number;
  }

  type SortOrder = 'best' | 'alphabetical' | 'length';

  // Local state
  let modalSegment = $state<number | null>(null); // null or wordCount to show in modal
  let modalSortOrder = $state<SortOrder>('best'); // 'best' or 'alphabetical'
  let modalSearchQuery = $state(''); // Search query for filtering modal solutions

  // Parse solution string to extract words and score
  function parseSolution(solutionStr: string): ParsedSolution {
    const parts: string[] = solutionStr.split(':');
    const words: string = parts[0] || '';
    const score: string = parts[1] || '';
    // Calculate length excluding dashes
    const length: number = words.replace(/-/g, '').length;
    return { words, score, length };
  }

  // Group all solutions by word count (derived from $solutions)
  const solutionsByWordCount = $derived.by(() => {
    const grouped: string[][] = [];
    $solutions.forEach((solution: string) => {
      const { words } = parseSolution(solution);
      const wordCount: number = words.split('-').length;
      if (!grouped[wordCount]) {
        grouped[wordCount] = [];
      }
      grouped[wordCount].push(solution);
    });
    return grouped;
  });

  // Get total count for a given word count
  function getTotalCount(wordCount: number): number {
    return solutionsByWordCount[wordCount]?.length || 0;
  }

  // Get solutions to display for a given word count
  function getSolutionsForWordCount(wordCount: number): string[] {
    return solutionsByWordCount[wordCount] || [];
  }

  // Get all word counts that have solutions (for iteration)
  function getWordCounts(): number[] {
    return solutionsByWordCount
      .map((_, idx) => idx)
      .filter(idx => (solutionsByWordCount[idx] ?? []).length > 0)
      .sort((a, b) => a - b);
  }

  // Get sorted and filtered solutions for modal
  const modalSolutions = $derived.by(() =>
    modalSegment !== null && solutionsByWordCount[modalSegment]
      ? getFilteredSolutions(
          getSortedSolutions(solutionsByWordCount[modalSegment] || [], modalSortOrder),
          modalSearchQuery
        )
      : []
  );

  function getSortedSolutions(solutionsArray: string[], sortOrder: SortOrder): string[] {
    const sorted: string[] = [...solutionsArray];
    if (sortOrder === 'alphabetical') {
      return sorted.sort((a: string, b: string) => a.localeCompare(b));
    }
    if (sortOrder === 'length') {
      return sorted.sort((a: string, b: string) => {
        const lengthA = parseSolution(a).length;
        const lengthB = parseSolution(b).length;
        return lengthA - lengthB;
      });
    }
    // 'best' keeps the original order (already sorted by score from solver)
    return sorted;
  }

  function getFilteredSolutions(solutionsArray: string[], searchQuery: string): string[] {
    if (!searchQuery.trim()) {
      return solutionsArray;
    }
    const query = searchQuery.toLowerCase();
    return solutionsArray.filter((solution: string) => {
      const { words } = parseSolution(solution);
      return words.toLowerCase().includes(query);
    });
  }

  function showModal(wordCount: number): void {
    modalSegment = wordCount;
    modalSortOrder = 'best'; // Reset to 'best' when opening modal
    modalSearchQuery = ''; // Reset search when opening modal
  }

  function closeModal(): void {
    modalSegment = null;
    modalSearchQuery = ''; // Clear search when closing modal
  }

  // Handle escape key to close modal
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && modalSegment !== null) {
      closeModal();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="solutions-container" class:play-mode={playMode}>
  {#if $isPuzzleComplete}
    {#if $solving}
      <!-- Show loading state while solving -->
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <span class="loading-text">Finding solutions...</span>
      </div>
    {:else if $solutions.length === 0}
      <!-- No solutions found -->
      <div class="no-solutions">No solutions found!</div>
    {:else}
      <!-- Solution summaries -->
      <div class="expanded-view">
        {#each getWordCounts() as wordCount}
          {@const segmentSolutions = getSolutionsForWordCount(wordCount)}
          {@const total = getTotalCount(wordCount)}
          {@const showButton = total > 3}

          <div class="segment">
            <div class="segment-header">
              <span class="segment-label">{wordCount}-word solution{wordCount === 1 ? '' : 's'}</span>
              {#if showButton}
                <button
                  class="show-all-btn"
                  on:click={() => showModal(wordCount)}
                >
                  Show all {total}
                </button>
              {/if}
            </div>

            <div class="solutions-list">
              {#each segmentSolutions.slice(0, 3) as solution}
                {@const parsed = parseSolution(solution)}
                <div class="solution-item">
                  <span class="solution-words">{parsed.words}</span>
                  <span class="solution-score">{parsed.score}</span>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
      <div class="no-solutions">No puzzle, no solutions...</div>
  {/if}
</div>

<!-- Modal -->
{#if modalSegment !== null}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div tabindex="0" class="modal-overlay" on:click={closeModal} role="dialog" aria-modal="true">
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="modal-content" on:click|stopPropagation role="document">
      <div class="modal-header">
        <div class="modal-header-left">
          <h3>{modalSegment}-word solutions 
            ({(solutionsByWordCount[modalSegment] || []).length} 
            total{#if modalSolutions.length < (solutionsByWordCount[modalSegment] || []).length}, {modalSolutions.length} shown{/if})</h3>
          <div class="modal-controls">
            <div class="sort-control">
              <label for="sort-select">Sort by:</label>
              <select id="sort-select" bind:value={modalSortOrder}>
                <option value="best">Best</option>
                <option value="alphabetical">A-Z</option>
                <option value="length">Length</option>
              </select>
            </div>
            <div class="search-control">
              <label for="search-input">Search:</label>
              <input
                id="search-input"
                type="text"
                bind:value={modalSearchQuery}
                placeholder="Filter solutions..."
              />
            </div>
          </div>
        </div>
        <button class="close-btn" on:click={closeModal}>&times;</button>
      </div>
      <div class="modal-body">
        {#each modalSolutions as solution}
          {@const parsed = parseSolution(solution)}
          <div class="modal-solution-item">
            <span class="solution-words">{parsed.words}</span>
            <span class="solution-score">{parsed.score}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .solutions-container {
    margin-top: 20px;
  }

  .solutions-container.play-mode {
    display: none;
  }

  .loading-state {
    border: 1px solid var(--color-border-light);
    border-radius: 6px;
    padding: 40px 15px;
    background: var(--color-bg-container);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--color-border-light);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-text {
    color: var(--color-text-muted);
    font-size: 14px;
  }

  .no-solutions {
    padding: 20px;
    text-align: center;
    color: var(--color-text-muted);
    font-style: italic;
  }

  .show-all-btn {
    background: none;
    border: 1px solid var(--color-primary);
    color: var(--color-primary);
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .show-all-btn:hover:not(:disabled) {
    background: var(--color-primary);
    color: white;
  }

  .show-all-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    border-color: var(--color-text-muted);
    color: var(--color-text-muted);
  }

  .expanded-view {
    border: 1px solid var(--color-border-light);
    border-radius: 6px;
    background: var(--color-bg-container);
  }

  .segment {
    border-bottom: 1px solid var(--color-border-light);
    padding: 12px 15px;
  }

  .segment:last-child {
    border-bottom: none;
  }

  .segment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .segment-label {
    font-weight: 500;
    color: var(--color-text);
  }

  .solutions-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .solution-item {
    padding: 6px 12px;
    background: var(--color-bg-light);
    border-radius: 2px;
    font-size: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .solution-words {
    flex: 1;
  }

  .solution-score {
    font-style: italic;
    color: var(--color-text-muted);
    font-size: 13px;
  }

  /* Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    padding: 20px;
  }

  .modal-content {
    background: var(--color-bg-container);
    border-radius: 8px;
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 20px;
    border-bottom: 2px solid var(--color-border-light);
  }

  .modal-header-left {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .modal-header h3 {
    margin: 0;
    color: var(--color-primary);
    font-size: 20px;
  }

  .modal-controls {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }

  .sort-control {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sort-control label {
    font-size: 14px;
    color: var(--color-text-muted);
  }

  .sort-control select {
    padding: 4px 8px;
    border: 1px solid var(--color-border-light);
    border-radius: 4px;
    background: var(--color-bg-container);
    color: var(--color-text);
    font-size: 14px;
    cursor: pointer;
  }

  .sort-control select:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
  }

  .search-control {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .search-control label {
    font-size: 14px;
    color: var(--color-text-muted);
  }

  .search-control input {
    padding: 4px 8px;
    border: 1px solid var(--color-border-light);
    border-radius: 4px;
    background: var(--color-bg-container);
    color: var(--color-text);
    font-size: 14px;
    min-width: 200px;
  }

  .search-control input:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: 1px;
  }

  .search-control input::placeholder {
    color: var(--color-text-muted);
    opacity: 0.7;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 32px;
    color: var(--color-text-muted);
    cursor: pointer;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s ease;
  }

  .close-btn:hover {
    background: var(--color-bg-light);
    color: var(--color-text);
  }

  .modal-body {
    padding: 20px;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
  }

  .modal-solution-item {
    padding: 8px 12px;
    background: var(--color-bg-light);
    border-radius: 2px;
    font-size: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
</style>
