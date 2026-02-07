import { writable, get, type Writable } from 'svelte/store';

interface SolveStats {
  totalCount: number;
  duration: number | null;
}

interface WorkerMessage {
  type: string;
  solveId?: number;
  solutions?: string[];
  totalCount?: number;
  duration?: number;
  error?: string;
  playableWords?: Set<string>;
}

export const solverReady: Writable<boolean> = writable(false);
export const solving: Writable<boolean> = writable(false);
export const solutions: Writable<string[]> = writable([]);
export const solveStats: Writable<SolveStats> = writable({ totalCount: 0, duration: null });
export const solverError: Writable<string | null> = writable(null);

// Board preloading state
export const boardPreloaded: Writable<boolean> = writable(false);
export const boardPreloading: Writable<boolean> = writable(false);
export const playableWords: Writable<Set<string> | null> = writable(null);

let currentSolveId = 0;
let worker: Worker | null = null;

export function initializeSolverWorker(dictionaryData: Uint8Array): void {
  worker = new Worker(
    new URL('../workers/solver-worker.ts', import.meta.url),
    { type: 'module' }
  );

  worker.addEventListener('message', (e: MessageEvent<WorkerMessage>) => {
    const { type, solveId, solutions: receivedSolutions, totalCount, duration, error, playableWords: receivedWords } = e.data;

    console.log(`[Store] Received ${type} message, solveId=${solveId}, currentSolveId=${currentSolveId}`);

    if (type === 'READY') {
      solverReady.set(true);
    }

    if (type === 'PLAYABLE_WORDS') {
      console.log(`[Store] Received playable words, count=${receivedWords?.size}`);
      if (receivedWords) {
        playableWords.set(receivedWords);
        boardPreloaded.set(true);
        boardPreloading.set(false);
      } else {
        console.error('No playable words in PLAYABLE_WORDS message');
        boardPreloaded.set(false);
        boardPreloading.set(false);
      }
    }

    if (type === 'COMPLETE') {
      console.log(`[Store] COMPLETE check: solveId=${solveId}, currentSolveId=${currentSolveId}, match=${solveId === currentSolveId}, solutions count=${receivedSolutions?.length}`);
      if (solveId === currentSolveId && receivedSolutions) {
        console.log(`[Store] Setting solutions, count=${receivedSolutions.length}`);
        // Solutions are already sorted by score from the Rust solver
        solutions.set(receivedSolutions);
        solving.set(false);
        if (totalCount !== undefined && duration !== undefined) {
          solveStats.set({ totalCount, duration });
        }
      } else {
        console.log(`[Store] Ignoring COMPLETE - solveId mismatch or no solutions`);
      }
    }

    if (type === 'CANCELLED') {
      console.log(`Solve ${solveId} was cancelled.`);
      solving.set(false);
    }

    if (type === 'ERROR') {
      console.error('Solver error:', error);
      solverError.set(error ?? 'Unknown error');
      solving.set(false);
      // Also clear preloading state on error
      boardPreloading.set(false);
    }
  });

  worker.postMessage({
    type: 'INIT',
    payload: { dictionaryData }
  });
}

export function preloadBoard(sides: string[]): void {
  if (!worker) {
    console.error('Worker not initialized');
    return;
  }

  console.log(`[Store] preloadBoard called, sides=${sides.join(',')}`);
  boardPreloading.set(true);
  boardPreloaded.set(false);
  playableWords.set(null);

  worker.postMessage({
    type: 'GET_PLAYABLE_WORDS',
    payload: { sides }
  });
}

export function solvePuzzle(sides: string[], maxSolutions = 10000): void {
  if (!worker) {
    console.error('Worker not initialized');
    return;
  }

  // Safety check - board must be preloaded
  if (!get(boardPreloaded)) {
    console.error('Board not preloaded - cannot solve');
    solverError.set('Board not preloaded. Please wait for board to initialize.');
    return;
  }

  currentSolveId++;
  console.log(`[Store] solvePuzzle called, new solveId=${currentSolveId}, sides=${sides.join(',')}`);
  solving.set(true);
  solutions.set([]);
  solveStats.set({ totalCount: 0, duration: null });
  solverError.set(null);

  worker.postMessage({
    type: 'SOLVE',
    solveId: currentSolveId,
    payload: { sides, maxSolutions }
  });
}

export function cancelSolve(): void {
  if (worker) {
    worker.postMessage({ type: 'CANCEL' });
    solving.set(false);
  }
}
