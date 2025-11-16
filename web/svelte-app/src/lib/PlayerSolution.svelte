<script lang="ts">
  import { playerSolution, puzzleFields } from '../stores/puzzle';

  let { playMode = false } = $props<{ playMode?: boolean }>();

  // Convert word (array of indices) to string
  function wordToString(word: number[]): string {
    return word.map(index => $puzzleFields[index] || '').join('');
  }
</script>

<div class="player-solution-container" class:solve-mode={!playMode}>
  {#if $playerSolution.length === 0}
    <span class="empty-message">Click letters to start building your solution</span>
  {:else}
    {#each $playerSolution as word, i}
      <span class="word">{wordToString(word)}</span>{#if i < $playerSolution.length - 1}<span class="separator"> → </span>{/if}
    {/each}
  {/if}
</div>

<style>
  .player-solution-container {
    margin-top: 20px;
    padding: 15px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: x-large;
    min-height: 50px;
    display: flex;
    align-items: center;
  }

  .player-solution-container.solve-mode {
    display: none;
  }

  .empty-message {
    color: var(--color-text-muted, #888);
    font-size: medium;
    font-style: italic;
  }

  .word {
    font-weight: bold;
    text-transform: uppercase;
  }

  .separator {
    margin: 0 8px;
    color: var(--color-text-muted, #888);
  }
</style>