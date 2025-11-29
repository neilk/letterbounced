<script lang="ts">
  import { playerSolution, puzzleFields, backspacePlayerSolution, advanceToNextWord } from '../stores/puzzle';
  import { checkWord } from '../stores/solver-worker';

  let { playMode = false } = $props<{ playMode?: boolean }>();

  let isLastWordValid = $state(false);

  const MINIMUM_WORD_LENGTH = 3;

  // Convert word (array of indices) to string
  function wordToString(word: number[]): string {
    return word.map(index => $puzzleFields[index] || '').join('');
  }

  // Check if there's anything to backspace
  function hasContent(): boolean {
    return $playerSolution.length > 0 &&
           $playerSolution.some(word => word.length > 0);
  }

  // Check if the last word is valid in the dictionary
  $effect(() => {
    if ($playerSolution.length > 0) {
      const lastWord = $playerSolution[$playerSolution.length - 1];
      if (lastWord && lastWord.length >= MINIMUM_WORD_LENGTH) {
        const wordStr = wordToString(lastWord);
        checkWord(wordStr).then(valid => {
          isLastWordValid = valid;
        });
      } else {
        isLastWordValid = false;
      }
    } else {
      isLastWordValid = false;
    }
  });
</script>

<div class="player-solution-wrapper" class:solve-mode={!playMode}>
  <div class="player-solution-container">
    {#if $playerSolution.length === 0}
      <span class="empty-message">Click letters to start building your solution</span>
    {:else}
      {#each $playerSolution as word, i}
        <span class="word">{wordToString(word)}</span>{#if i < $playerSolution.length - 1}<span class="separator"> → </span>{/if}
      {/each}
      {#if playMode && isLastWordValid}
        <button class="next-word-button" onclick={advanceToNextWord} type="button" title="Start next word">
          ✓
        </button>
      {/if}
    {/if}
  </div>
  {#if playMode && hasContent()}
    <button class="backspace-button" onclick={backspacePlayerSolution} type="button">
      ⌫
    </button>
  {/if}
</div>

<style>
  .player-solution-wrapper {
    margin-top: 20px;
    padding: 15px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    min-height: 50px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .player-solution-wrapper.solve-mode {
    display: none;
  }

  .player-solution-container {
    flex: 1;
    font-size: x-large;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    min-width: 0;
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

  .backspace-button {
    padding: 8px 12px;
    font-size: 20px;
    background-color: var(--color-bg-secondary, #f0f0f0);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
    flex-shrink: 0;
    align-self: flex-start;
  }

  .backspace-button:hover {
    background-color: var(--color-bg-hover, #e0e0e0);
  }

  .backspace-button:active {
    background-color: var(--color-bg-active, #d0d0d0);
  }

  .next-word-button {
    padding: 8px 12px;
    font-size: 20px;
    background-color: #4CAF50;
    color: white;
    border: 1px solid #45a049;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
    flex-shrink: 0;
    margin-left: 10px;
  }

  .next-word-button:hover {
    background-color: #45a049;
  }

  .next-word-button:active {
    background-color: #3d8b40;
  }
</style>