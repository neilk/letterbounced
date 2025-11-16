<script lang="ts">
  let { playMode = false } = $props<{ playMode?: boolean }>();
</script>

<div class="player-solution-container" class:solve-mode={!playMode}>
  Foo
</div>

<style>
  .player-solution-container {
    margin-top: 20px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    font-size: x-large;
  }

  .player-solution-container.solve-mode {
    display: none;
  }
</style>