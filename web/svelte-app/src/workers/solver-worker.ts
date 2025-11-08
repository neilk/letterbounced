import init, { initialize_dictionary, solve_game, cancel_current_solve } from '../pkg/letter_bounced.js';

const DICTIONARY_URL = '/dictionary.txt';

interface WorkerMessageData {
  type: 'INIT' | 'CANCEL' | 'SOLVE';
  payload?: {
    dictionaryData?: Uint8Array;
    sides?: string[];
    maxSolutions?: number;
  };
  solveId?: number;
}

interface OutgoingMessage {
  type: 'READY' | 'COMPLETE' | 'CANCELLED' | 'ERROR';
  solveId?: number;
  solutions?: string[];
  totalCount?: number;
  duration?: number;
  error?: string;
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
      const response = await fetch(DICTIONARY_URL);
      if (!response.ok) {
        throw new Error(`Error fetching ${DICTIONARY_URL}: ${response.status} ${response.statusText}`)
      }
      const dictionaryText = await response.text();
      const dictionaryData = new TextEncoder().encode(dictionaryText);
      initialize_dictionary(dictionaryData);
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

      console.log(`[Worker] Calling solve_game for solveId=${solveId}`);
      // Call the Promise-based solve_game
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
});
