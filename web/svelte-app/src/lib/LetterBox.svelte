<script lang="ts">
  import { puzzleFields } from '../stores/puzzle';

  // Order: clockwise starting from top-left
  const clockwiseFieldIndices = [0, 1, 2, 3, 4, 5, 8, 7, 6, 11, 10, 9];

  let jumping: boolean[] = $state(Array(12).fill(false));
  let displayValues: string[] = $state(Array(12).fill(''));
  let sequentialTimeouts: number[] = [];
  let isUserTyping = false;

  // Effect to watch puzzleFields and update display sequentially when not typing
  $effect(() => {
    const fields = $puzzleFields;

    // If user is typing, update immediately
    if (isUserTyping) {
      displayValues = [...fields];
      isUserTyping = false;
      return;
    }

    // Otherwise, animate sequentially (for puzzle loads)
    // Clear any pending timeouts
    sequentialTimeouts.forEach(clearTimeout);
    // Add new timeouts for animating the letter
    sequentialTimeouts = clockwiseFieldIndices.map((fieldIndex, sequenceIndex) => window.setTimeout(() => {
        displayValues[fieldIndex] = fields[fieldIndex] || '';
        jumping[fieldIndex] = true;
      }, sequenceIndex * 50));
  });

  function handleInput(index: number, event: Event): void {
    const target = event.target as HTMLInputElement;
    const value = target.value.toUpperCase();

    // Mark that user is typing (to skip sequential animation)
    isUserTyping = true;

    // Only allow single uppercase letter
    if (value.length > 0) {
      const letter = value[value.length - 1]!.replace(/[^A-Z]/g, '');
      target.value = letter;

      // Update store (effect will handle display update immediately)
      puzzleFields.update(fields => {
        const newFields = [...fields];
        newFields[index] = letter;
        return newFields;
      });

      // Trigger jump animation (includes color inversion)
      jumping[index] = true;

      // Auto-advance to next field
      if (letter && index < 11) {
        const nextField = document.getElementById(`char${String(index + 1).padStart(2, '0')}`);
        if (nextField instanceof HTMLInputElement) {
          nextField.focus();
          nextField.select();
        }
      }
    } else {
      target.value = '';
      puzzleFields.update(fields => {
        const newFields = [...fields];
        newFields[index] = '';
        return newFields;
      });
    }
  }

  function handleAnimationEnd(index: number): void {
    jumping[index] = false;
  }

  function handleKeydown(index: number, event: KeyboardEvent): void {
    const target = event.target as HTMLInputElement;
    // Handle backspace to go to previous field
    if (event.key === 'Backspace' && !target.value && index > 0) {
      event.preventDefault();
      const prevField = document.getElementById(`char${String(index - 1).padStart(2, '0')}`);
      if (prevField instanceof HTMLInputElement) {
        prevField.focus();
        prevField.select();
      }
    }
  }

  function handleFocusOrClick(event: MouseEvent | FocusEvent): void {
    const target = event.target as HTMLInputElement;
    target.select();
  }

</script>

<div class="letter-box-container">
  {#each Array(12) as _, index}
    <input
      type="text"
      id="char{String(index).padStart(2, '0')}"
      class="letter-field"
      class:jump={jumping[index]}
      value={displayValues[index]}
      on:input={(e) => handleInput(index, e)}
      on:keydown={(e) => handleKeydown(index, e)}
      on:click={handleFocusOrClick}
      on:focus={handleFocusOrClick}
      on:animationend={() => handleAnimationEnd(index)}>
  {/each}
</div>

<style>
  .letter-box-container {
    width: 100%;
    aspect-ratio: 1;
    position: relative;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    grid-template-rows: repeat(5, 1fr);
    gap: 8px;
    /* padding: 20px; */
  }

  .letter-field {
    width: 100%;
    height: 100%;
    text-align: center;
    font-size: clamp(24px, 8vw, 80px);
    font-weight: bold;
    text-transform: uppercase;
    color: var(--color-text-input);
    border: 2px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-bg-white);
    padding: 0;
  }

  .letter-field:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-light);
  }

  /* Top side - char00, char01, char02 (left to right) */
  #char00 { grid-column: 2; grid-row: 1; }
  #char01 { grid-column: 3; grid-row: 1; }
  #char02 { grid-column: 4; grid-row: 1; }

  /* Right side - char03, char04, char05 (top to bottom) */
  #char03 { grid-column: 5; grid-row: 2; }
  #char04 { grid-column: 5; grid-row: 3; }
  #char05 { grid-column: 5; grid-row: 4; }

  /* Bottom side - char06, char07, char08 (top to bottom) */
  #char06 { grid-column: 2; grid-row: 5; }
  #char07 { grid-column: 3; grid-row: 5; }
  #char08 { grid-column: 4; grid-row: 5; }

  /* Left side - char09, char10, char11 (left to right) */
  #char09 { grid-column: 1; grid-row: 2; }
  #char10 { grid-column: 1; grid-row: 3; }
  #char11 { grid-column: 1; grid-row: 4; }

  /* Jump animations - each side jumps away from center */
  @keyframes jump-up {
    0% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-25%);
    }
    100% {
      transform: translateY(0);
    }
  }

  @keyframes jump-right {
    0% {
      transform: translateX(0);
    }
    50% {
      transform: translateX(25%);
    }
    100% {
      transform: translateX(0);
    }
  }

  @keyframes jump-down {
    0% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(25%);
    }
    100% {
      transform: translateY(0);
    }
  }

  @keyframes jump-left {
    0% {
      transform: translateX(0);
    }
    50% {
      transform: translateX(-25%);
    }
    100% {
      transform: translateX(0);
    }
  }

  /* Top side (char00, char01, char02) - jump up with color inversion */
  #char00.jump,
  #char01.jump,
  #char02.jump {
    animation: jump-up 0.4s ease-out, color-fade 0.4s ease-out;
  }

  /* Right side (char03, char04, char05) - jump right with color inversion */
  #char03.jump,
  #char04.jump,
  #char05.jump {
    animation: jump-right 0.4s ease-out, color-fade 0.4s ease-out;
  }

  /* Bottom side (char06, char07, char08) - jump down with color inversion */
  #char06.jump,
  #char07.jump,
  #char08.jump {
    animation: jump-down 0.4s ease-out, color-fade 0.4s ease-out;
  }

  /* Left side (char09, char10, char11) - jump left with color inversion */
  #char09.jump,
  #char10.jump,
  #char11.jump {
    animation: jump-left 0.4s ease-out, color-fade 0.4s ease-out;
  }

  /* Color inversion animation - instant invert, slow fade back */
  @keyframes color-fade {
    0% {
      filter: invert(1);
    }
    100% {
      filter: invert(0);
    }
  }
</style>
