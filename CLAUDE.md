# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Boxchar is a Rust word game application that implements a letter-based puzzle where players form words using letters from four sides of a box. The game validates letter combinations (digraphs) that can be formed between different sides.

## Commands

### Build and Run
- `cargo build` - Build the project
- `cargo run` - Run the main application (loads and displays game from data/game.txt)
- `cargo test` - Run all tests
- `cargo test <test_name>` - Run a specific test

### Development
- `cargo check` - Quick syntax check without building
- `cargo clippy` - Run linting
- `cargo fmt` - Format code

### Web/WASM Build
- `./build-web.sh` - Build WASM package and set up web directory
- `cd web && npx http-server -p 8000` - Serve web application locally

## Problem statement

Letter Boxed is a word game where the player is given a set of letters, all different, laid out as a square.

The player's goal is find two or more words which, when linked together, can visit every letter in the puzzle. A player cannot connect two letters on the same "side" of the square. When a player stops 
a word, the player must start the word on the same character as they stopped.

For example, given the puzzle:
    JGH NVY EID ORP

A possible two word solution is:
    HYPERDRIVE ENJOINING

Note that the last letter, of HYPERDRIVE, "E", is the first letter of "ENJOINING".

Note that for each character of the word, we must hop to a different "side". H is in the first side,
Y is in the second side, P is in the fourth side, and so on. We could not play a word like PRIVY, because
P and R are in the same group, as are V and Y.

A three word solution to the same puzzle is:
    GIRD DOJO OVERHYPING

Again note that the words are connected: GIRD ends with D, then DOJO begins with D, and so on.

Our goal is to efficiently generate and rank solutions to these puzzles. Two word solutions are better
than three word solutions. Common words are better than uncommon words.

## Strategy

Simply connecting letters to letters and hoping that we eventually visit all the letters will take 
far too long. We observe that there are some ways to simplify the problem.

The game is actually about assembling words from digraphs. In our sample puzzle, digraphs like "JE" are allowed, and others such as "EI" are forbidden. 

Only some digraphs exist in the English language. There are no words with "GV", so we don't have to 
consider them at all. By pre-analyzing our word list, we can immediately eliminate some digraphs from the puzzle from consideration.

Only some words in the English language are even possible to represent on a Letter Boxed board. Since 
every letter in a Letter Boxed game is unique, and one must always hop to a different letter, there 
can be no letter repetitions. A word like "DOJO" is possible in our sample puzzle, but "PEER" is not 
possible. We can use this to cut down the dictionary somewhat.

Finally, digraphs may be representable as numbers since each character easily fits in four bits and 
all characters in the puzzle are unique. We may be then able to use bitwise operations to represent how much of the board is "visited" by any one word, which would make testing combinations dramatically
faster on computer hardware.

### Other possible ideas

It may be more optimal to search forwards and backwards. We could simply consider each character as a 
"connection character", and look for combinations of words going forwards and backwards. This would 
entail processing the wordlist twice; one for "forwards" and once for "backwards". This may be extendable to a three word solution by considering subsets of the puzzle.

## Architecture

### Core Components

**Game Structure (`src/game.rs`)**
- `Game` struct manages the four-sided letter box and valid digraph combinations
- Validates game files must have exactly 4 sides with equal lengths
- Ensures no duplicate letters across all sides and only uppercase ASCII letters
- Computes all valid digraphs (letter pairs from different sides)

**Library Structure (`src/lib.rs`)**
- Exports `game` and `build_digraph_list` modules
- Main application (`src/main.rs`) uses the library to load and display games

**Data Processing (`src/wordlist.rs`)**
- Handles wordlist file reading and processing
- Functions for extracting digraphs from word lists

### Key Validation Rules
- Game files must contain exactly 4 lines (sides)
- All sides must have the same length
- Only uppercase ASCII letters allowed
- No duplicate letters across any sides
- Valid digraphs can only be formed between letters from different sides

### Data Files
- `data/board.txt` - Sample board configuration (4 sides of letters)
- `data/dictionary.txt` - Word dictionary for validation
- `data/dictionary_test.txt` - Test word list
- `data/answers.txt` - Valid answers/solutions

## Web Application

### Current Implementation (Svelte)

The web application has been migrated from vanilla HTML/JS to Svelte for better state management and future game features.

**Location**: `web/svelte-app/`

**Commands**:
- `cd web/svelte-app && npm install` - Install dependencies
- `npm run dev` - Start development server (http://localhost:5173/)
- `npm run build` - Build for production
- `npm test` - Run unit tests (Vitest)
- `npm run test:watch` - Run unit tests in watch mode
- `npm run test:e2e` - Run end-to-end tests (Playwright)

**Testing**:
- **Unit tests** (`tests/unit/`): Vitest tests for store logic and business rules
  - Tests puzzle state management, player solution logic, appendability validation
  - Uses localStorage mock for Node environment
  - Fast, isolated tests without browser
- **E2E tests** (`tests/browser/`): Playwright tests for full user workflows
  - Tests complete UI interactions and state updates
  - Runs in real browser with dev server
  - Validates user experience end-to-end

**Architecture**:
- **Stores** (`src/stores/`):
  - `puzzle.js` - Reactive puzzle state (sides, solutions, solving status)
  - `wasm.js` - WASM module and dictionary initialization

- **Components** (`src/lib/`):
  - `PuzzleLoader.svelte` - Load NYT or sample puzzles
  - `LetterBox.svelte` - 12-field letter input grid with auto-navigation
  - `SolutionsDisplay.svelte` - Segmented solution display with pagination

- **Key Features**:
  - Reactive data model - puzzle state changes automatically update UI
  - localStorage integration for puzzle persistence
  - Sequential WASM initialization to avoid race conditions
  - Hardcoded max solutions: 10000

### Future Development

**Planned Features**:

1. **Visual Solution Path Animation**
   - Add canvas overlay inside the letter box square
   - Animate the path of solutions "bouncing" between letters
   - Show visual connections between consecutive letters in a word
   - Highlight letters as they are visited in sequence

2. **Interactive Letter Tracing Game**
   - Canvas-based bouncing ball physics simulation
   - User can trace paths by "bouncing" between letters
   - Letters react when "hit" by the ball (visual feedback)
   - Real-time validation of valid word formation
   - Track which letters have been visited
   - Detect when user completes a valid word

3. **Design Goals**:
   - Keep the website extremely minimal
   - Simple, clean animations (use Svelte transitions and `svelte/motion`)
   - Mix declarative UI (Svelte) with imperative canvas for game elements
   - Maintain small bundle size

**Why Svelte**:
- Minimal runtime overhead (compiles to vanilla JS)
- Built-in reactivity perfect for game state
- Excellent animation primitives (`svelte/motion`, `svelte/transition`)
- Easy canvas integration alongside components
- Simple learning curve

**Implementation Notes**:
- Game state should live in Svelte stores
- Canvas can be a Svelte component that subscribes to stores
- Letter highlighting/reactions can use Svelte transitions
- Ball physics can use `svelte/motion` springs for natural movement
- Consider splitting game mode and solver mode into separate views

### Legacy Version

The original vanilla HTML/JS version is preserved at `web/index.html` for reference.