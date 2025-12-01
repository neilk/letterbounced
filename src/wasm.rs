use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use crate::board::Board;
use crate::dictionary::Dictionary;
use crate::solver::{Solver, Solution};
use std::sync::{OnceLock, Mutex};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use js_sys::{Promise, Set};
use lru::LruCache;
use std::num::NonZeroUsize;

// Import the `console.log` function from the browser's Web API
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// Define a macro to make console logging easier
macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

/// Cached data for a board, including optional solved solutions and playable dictionary
#[derive(Clone)]
struct CachedBoardData {
    board: Board,
    playable_dictionary: Dictionary,
    solutions: Option<Vec<Solution>>,
}

impl CachedBoardData {
    fn new(board: Board, playable_dictionary: Dictionary) -> Self {
        CachedBoardData {
            board,
            playable_dictionary,
            solutions: None,
        }
    }

    fn with_solutions(board: Board, playable_dictionary: Dictionary, solutions: Vec<Solution>) -> Self {
        CachedBoardData {
            board,
            playable_dictionary,
            solutions: Some(solutions),
        }
    }
}

// Global dictionary storage (wrapped in Arc for sharing across tasks)
static GLOBAL_DICTIONARY: OnceLock<Arc<Dictionary>> = OnceLock::new();

// Board cache (LRU cache with capacity of 10 boards with solutions)
static BOARD_CACHE: OnceLock<Mutex<LruCache<Vec<String>, CachedBoardData>>> = OnceLock::new();

// Current solve task state
#[derive(Clone, PartialEq)]
struct SolveParams {
    sides: Vec<String>,
    max_solutions: u16,
}

struct SolveTask {
    params: SolveParams,
    cancel_flag: Arc<AtomicBool>,
}

static CURRENT_SOLVE: OnceLock<Mutex<Option<SolveTask>>> = OnceLock::new();

/// Get cached board data from cache only (does not create)
fn get_cached_board_data(game_sides: &Vec<String>) -> Result<CachedBoardData, String> {
    // Get or initialize the board cache (lazy initialization)
    let cache_mutex = BOARD_CACHE.get_or_init(|| {
        console_log!("Initializing board cache with capacity 10");
        let cache_capacity = NonZeroUsize::new(10).unwrap();
        Mutex::new(LruCache::new(cache_capacity))
    });

    let mut cache = cache_mutex.lock().unwrap();

    // Check if board is in cache
    if let Some(cached_data) = cache.get(game_sides) {
        console_log!("Board cache hit");
        Ok(cached_data.clone())
    } else {
        console_log!("Board cache miss - board not preloaded");
        Err("Board not preloaded. Call preload_board first.".to_string())
    }
}

/// Get cached board data from cache or create a new one
fn get_or_create_board_data(game_sides: Vec<String>, dictionary: &Dictionary) -> Result<CachedBoardData, String> {
    // Get or initialize the board cache (lazy initialization)
    let cache_mutex = BOARD_CACHE.get_or_init(|| {
        console_log!("Initializing board cache with capacity 10");
        let cache_capacity = NonZeroUsize::new(10).unwrap();
        Mutex::new(LruCache::new(cache_capacity))
    });

    let mut cache = cache_mutex.lock().unwrap();

    // Check if board is in cache
    if let Some(cached_data) = cache.get(&game_sides) {
        console_log!("Board cache hit");
        Ok(cached_data.clone())
    } else {
        console_log!("Board cache miss, creating new board");
        // Create new board
        let board = Board::from_sides(game_sides.clone())
            .map_err(|e| e.to_string())?;

        // Compute playable dictionary for this board
        console_log!("Computing playable dictionary for board");
        let playable_dictionary = board.playable_dictionary(dictionary);
        console_log!("Board has {} playable words", playable_dictionary.words.len());

        let data = CachedBoardData::new(board, playable_dictionary);
        // Insert into cache
        cache.put(game_sides, data.clone());
        Ok(data)
    }
}

#[wasm_bindgen]
pub fn initialize_dictionary(dictionary_data: Vec<u8>) -> Result<(), String> {
    console_log!("Initializing global dictionary from {} bytes", dictionary_data.len());

    let dictionary = Dictionary::from_bytes(&dictionary_data)?;
    console_log!("Parsed dictionary with {} words", dictionary.words.len());

    // Initialize the current solve tracker
    let _ = CURRENT_SOLVE.set(Mutex::new(None));

    match GLOBAL_DICTIONARY.set(Arc::new(dictionary)) {
        Ok(()) => {
            console_log!("Global dictionary initialized successfully");
            Ok(())
        }
        Err(_) => Err("Dictionary already initialized".to_string())
    }
}

#[wasm_bindgen]
pub fn preload_board(game_sides: Vec<String>) -> Result<(), String> {
    console_log!("Preload board requested with {} sides", game_sides.len());

    // Check if dictionary is initialized
    let dictionary = match GLOBAL_DICTIONARY.get() {
        Some(dict) => dict,
        None => {
            console_log!("Error: Dictionary not initialized");
            return Err("Dictionary not initialized".to_string());
        }
    };

    // Create or get the board data from cache
    match get_or_create_board_data(game_sides, &dictionary) {
        Ok(_) => {
            console_log!("Board preloaded successfully");
            Ok(())
        }
        Err(e) => {
            console_log!("Error preloading board: {}", e);
            Err(e)
        }
    }
}

#[wasm_bindgen]
pub fn get_playable_words(game_sides: Vec<String>) -> Result<Set, String> {
    console_log!("Get playable words requested with {} sides", game_sides.len());

    // Get the board data from cache (must be preloaded)
    let cached_data = match get_cached_board_data(&game_sides) {
        Ok(data) => data,
        Err(e) => {
            console_log!("Error: {}", e);
            return Err(e);
        }
    };

    // Create a JavaScript Set
    let js_set = Set::new(&JsValue::UNDEFINED);

    // Add all words from the playable dictionary to the Set
    for word in &cached_data.playable_dictionary.words {
        js_set.add(&JsValue::from_str(&word.word));
    }

    console_log!("Returning {} playable words", cached_data.playable_dictionary.words.len());
    Ok(js_set)
}

#[wasm_bindgen]
pub fn solve_game(game_sides: Vec<String>, max_solutions: u16) -> Promise {
    console_log!("Solve requested with {} sides", game_sides.len());

    future_to_promise(async move {
        let new_params = SolveParams {
            sides: game_sides.clone(),
            max_solutions,
        };

        // Check if we need to cancel an existing solve
        let cancel_flag = if let Some(solve_mutex) = CURRENT_SOLVE.get() {
            let mut current = solve_mutex.lock().unwrap();

            // If there's a current task with different params, cancel it
            if let Some(ref task) = *current {
                if task.params != new_params {
                    console_log!("Cancelling previous solve with different params");
                    task.cancel_flag.store(true, Ordering::Relaxed);
                } else {
                    console_log!("Solve already in progress with same params, rejecting duplicate");
                    return Err(JsValue::from_str("Solve already in progress"));
                }
            }

            // Create new cancel flag and task
            let cancel_flag = Arc::new(AtomicBool::new(false));
            *current = Some(SolveTask {
                params: new_params.clone(),
                cancel_flag: cancel_flag.clone(),
            });

            cancel_flag
        } else {
            console_log!("Error: CURRENT_SOLVE not initialized");
            return Err(JsValue::from_str("Solver not initialized"));
        };

        // Get the board data from cache (must be preloaded)
        let cached_data = match get_cached_board_data(&game_sides) {
            Ok(data) => data,
            Err(e) => {
                console_log!("Error: {}", e);

                // Clear current task since we failed
                if let Some(solve_mutex) = CURRENT_SOLVE.get() {
                    *solve_mutex.lock().unwrap() = None;
                }

                return Err(JsValue::from_str(&e));
            }
        };

        // Check if solutions are already cached
        let solutions = if let Some(cached_solutions) = cached_data.solutions {
            console_log!("Solutions cache hit - returning {} cached solutions", cached_solutions.len());
            cached_solutions
        } else {
            console_log!("Solutions cache miss - solving with {} playable words",
                cached_data.playable_dictionary.words.len());

            console_log!("Starting solve task");

            let solver = Solver::new(cached_data.board.clone(), &cached_data.playable_dictionary, max_solutions);
            let solutions = solver.solve_cancellable(Some(cancel_flag.clone()));

            // Cache the solutions
            if !cancel_flag.load(Ordering::Relaxed) {
                if let Some(cache_mutex) = BOARD_CACHE.get() {
                    let mut cache = cache_mutex.lock().unwrap();
                    let updated_data = CachedBoardData::with_solutions(
                        cached_data.board.clone(),
                        cached_data.playable_dictionary.clone(),
                        solutions.clone()
                    );
                    cache.put(game_sides.clone(), updated_data);
                    console_log!("Cached {} solutions", solutions.len());
                }
            }

            solutions
        };

        // Check if we were cancelled
        if cancel_flag.load(Ordering::Relaxed) {
            console_log!("Solve was cancelled");

            // Clear current task
            if let Some(solve_mutex) = CURRENT_SOLVE.get() {
                let mut current = solve_mutex.lock().unwrap();
                if let Some(ref task) = *current {
                    if Arc::ptr_eq(&task.cancel_flag, &cancel_flag) {
                        *current = None;
                    }
                }
            }

            return Err(JsValue::from_str("Cancelled"));
        }

        console_log!("Found {} solutions", solutions.len());

        // Convert solutions to JS array
        let js_array = js_sys::Array::new();
        for solution in &solutions {
            let solution_str = format!("{}:{}", solution.to_string(), solution.score);
            js_array.push(&JsValue::from_str(&solution_str));
        }

        // Clear current task
        if let Some(solve_mutex) = CURRENT_SOLVE.get() {
            let mut current = solve_mutex.lock().unwrap();
            if let Some(ref task) = *current {
                if Arc::ptr_eq(&task.cancel_flag, &cancel_flag) {
                    *current = None;
                }
            }
        }

        Ok(js_array.into())
    })
}

#[wasm_bindgen]
pub fn cancel_current_solve() {
    if let Some(solve_mutex) = CURRENT_SOLVE.get() {
        let mut current = solve_mutex.lock().unwrap();
        if let Some(ref task) = *current {
            console_log!("Cancelling current solve");
            task.cancel_flag.store(true, Ordering::Relaxed);
            *current = None;
        } else {
            console_log!("No solve in progress to cancel");
        }
    } else {
        console_log!("Warning: Solver not initialized");
    }
}