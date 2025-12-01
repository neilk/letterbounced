import init, { initialize_dictionary, preload_board, solve_game, cancel_current_solve, get_playable_words } from '../pkg/letter_bounced.js';

interface WorkerMessageData {
  type: 'INIT' | 'CANCEL' | 'SOLVE' | 'GET_PLAYABLE_WORDS';
  payload?: {
    dictionaryData?: Uint8Array;
    sides?: string[];
    maxSolutions?: number;
  };
  solveId?: number;
}

interface OutgoingMessage {
  type: 'READY' | 'COMPLETE' | 'CANCELLED' | 'ERROR' | 'PLAYABLE_WORDS';
  solveId?: number;
  solutions?: string[];
  totalCount?: number;
  duration?: number;
  error?: string;
  playableWords?: Set<string>;
}

let wasmReadyResolve: () => void = () => { };
let wasmReady: Promise<void> = new Promise((resolve) => {
  // This promise stays pending until INIT completes
  wasmReadyResolve = resolve;
});
let currentSolveId: number | null = null;

self.addEventListener('message', async (e: MessageEvent<WorkerMessageData>) => {
  const { type, payload, solveId } = e.data;

  if (type === 'INIT') {
    try {
      await init();
      if (payload?.dictionaryData) {
        await initialize_dictionary(payload.dictionaryData);
      }
      wasmReadyResolve(); // Resolve the pending promise
      self.postMessage({ type: 'READY' } as OutgoingMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      self.postMessage({ type: 'ERROR', error: errorMessage } as OutgoingMessage);
    }
  }

  if (type === 'CANCEL') {
    await wasmReady;
    cancel_current_solve();
    currentSolveId = null;
  }


  if (type === 'SOLVE') {
    // Wait for WASM to be ready
    await wasmReady;

    console.log(`[Worker] Received SOLVE request, solveId=${solveId}, sides=${payload?.sides?.join(',')}`);

    // Note: The WASM layer now handles cancellation automatically when a new solve
    // with different params is requested. We just track solveId for message correlation.
    currentSolveId = solveId ?? null;
    const sides = payload?.sides ?? [];
    const maxSolutions = payload?.maxSolutions ?? 10000;

    try {
      const startTime = performance.now();

      // Preload the board (this caches the board and playable dictionary)
      console.log(`[Worker] Preloading board for solveId=${solveId}`);
      await preload_board(sides);

      console.log(`[Worker] Calling solve_game for solveId=${solveId}`);
      // Call the Promise-based solve_game (requires board to be preloaded)
      const solutions = await solve_game(sides, maxSolutions);
      const duration = Math.round(performance.now() - startTime);

      // Convert JS array to regular array of strings
      const solutionsArray = Array.from(solutions);

      console.log(`[Worker] solve_game completed for solveId=${solveId}, solutions=${solutionsArray.length}, currentSolveId=${currentSolveId}`);

      // Only send complete message if this solve is still current
      if (currentSolveId === solveId) {
        console.log(`[Worker] Sending COMPLETE message for solveId=${solveId}`);
        self.postMessage({
          type: 'COMPLETE',
          solveId,
          solutions: solutionsArray,
          totalCount: solutionsArray.length,
          duration
        } as OutgoingMessage);
        currentSolveId = null;
      } else {
        console.log(`[Worker] NOT sending COMPLETE - currentSolveId changed to ${currentSolveId}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.log(`[Worker] solve_game failed for solveId=${solveId}, error=${errorMessage}`);

      // Check if it was a cancellation
      if (errorMessage === 'Cancelled' || errorMessage.includes('already in progress')) {
        self.postMessage({
          type: 'CANCELLED',
          solveId
        } as OutgoingMessage);
      } else {
        self.postMessage({
          type: 'ERROR',
          solveId,
          error: errorMessage
        } as OutgoingMessage);
      }
      currentSolveId = null;
    }
  }

  if (type === 'GET_PLAYABLE_WORDS') {
    // Wait for WASM to be ready
    await wasmReady;

    console.log(`[Worker] Received GET_PLAYABLE_WORDS request, sides=${payload?.sides?.join(',')}`);

    const sides = payload?.sides ?? [];

    try {
      // Get the playable words Set from WASM (board must be preloaded)
      const playableWords = get_playable_words(sides);

      console.log(`[Worker] Returning ${playableWords.size} playable words`);

      self.postMessage({
        type: 'PLAYABLE_WORDS',
        playableWords
      } as OutgoingMessage);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.log(`[Worker] get_playable_words failed, error=${errorMessage}`);

      self.postMessage({
        type: 'ERROR',
        error: errorMessage
      } as OutgoingMessage);
    }
  }
});
