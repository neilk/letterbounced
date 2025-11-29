# Letter Boxed Solver - Svelte Web App

A web interface for the Letter Boxed puzzle solver, built with Svelte and Vite, powered by Rust/WASM.

## Getting Started

### Prerequisites

- Node.js (v16+)
- The WASM package must be built first from the repository root: `../../build-web.sh`

### Installation

**Important: All npm commands must be run from the `web/svelte-app/` directory.**

```bash
npm install
```

## Development

### Development Mode

Run the Vite dev server with Hot Module Replacement (HMR).

**Make sure you are in the `web/svelte-app/` directory:**

```bash
# From repository root:
cd web/svelte-app

# Then run:
npm run dev
```

- Opens at http://localhost:8000/
- Changes to `.svelte` files update instantly in the browser
- Source maps enabled for debugging
- Optimized for development speed, not performance

### Production Build

Build optimized static files for deployment.

**Make sure you are in the `web/svelte-app/` directory:**

```bash
# From repository root:
cd web/svelte-app

# Then run:
npm run build
```

- Compiles Svelte to vanilla JavaScript
- Minifies and tree-shakes code
- Outputs to `dist/` directory
- Total bundle: ~50 KB (gzipped) + 2.2 MB dictionary + 79 KB WASM

### Preview Production Build

Test the production build locally (must run `npm run build` first).

**Make sure you are in the `web/svelte-app/` directory:**

```bash
# From repository root:
cd web/svelte-app

# Then run:
npm run preview
```

- Serves the `dist/` folder at http://localhost:4173/
- Use this to verify the production build works before deploying

## Testing

The project includes both unit tests and end-to-end tests.

### Test Structure

```
tests/
├── browser/           # Playwright e2e tests
│   ├── basic.spec.js
│   ├── edit-fields.spec.js
│   ├── fixture.ts
│   └── player-solution-reload.spec.js
└── unit/             # Vitest unit tests
    └── puzzle.test.ts
```

### Unit Tests (Vitest)

Test individual store functions and business logic without browser interaction.

**Make sure you are in the `web/svelte-app/` directory:**

```bash
# Run unit tests once
npm test

# Run unit tests in watch mode
npm run test:watch

# Open Vitest UI
npm run test:ui
```

**What's tested:**
- Puzzle state management (`puzzle.ts` store)
- Player solution logic
- Appendable field validation
- Mode switching (play/solve)

### End-to-End Tests (Playwright)

Test the full application in a browser, including user interactions.

**Make sure you are in the `web/svelte-app/` directory:**

```bash
# Run e2e tests
npm run test:e2e

# Run e2e tests with UI
npm run test:e2e:ui
```

**What's tested:**
- Complete user workflows
- UI interactions and state updates
- Letter input and validation
- Solution display and persistence
- Mode switching behavior

**Note:** E2E tests automatically start the dev server before running.

## Deployment

The `dist/` folder contains everything needed for deployment:
- Static HTML, CSS, JavaScript files
- WASM module and dictionary
- Can be served by any static file server
- No server-side processing required

Deploy to:
- GitHub Pages
- Netlify
- Vercel
- Any static hosting service
- Or use: `npx http-server dist/`

## Architecture

### Stores (`src/stores/`)
- `puzzle.js` - Reactive puzzle state (sides, solutions, solving status)
- `wasm.js` - WASM module and dictionary initialization

### Components (`src/lib/`)
- `PuzzleLoader.svelte` - Load NYT or sample puzzles
- `LetterBox.svelte` - 12-field letter input grid
- `SolutionsDisplay.svelte` - Segmented solution display with pagination

### Key Features
- Reactive data model - state changes automatically update UI
- localStorage integration for puzzle persistence
- Sequential WASM initialization to avoid race conditions
- Dictionary parsed once on load (~2 second initialization for 180K words)

## Future Optimizations

- Pre-process dictionary into binary format (using Serde) for faster loading
- Add progress indicator during dictionary initialization
- Cache parsed dictionary in IndexedDB

---

## Svelte + Vite Template Information

This template provides a minimal setup for Svelte with Vite and HMR.

### Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode).

### Technical Considerations

**Why use this over SvelteKit?**

- It brings its own routing solution which might not be preferable for some users.
- It is first and foremost a framework that just happens to use Vite under the hood, not a Vite app.

This template contains as little as possible to get started with Vite + Svelte, while taking into account the developer experience with regards to HMR and intellisense.

**Why is HMR not preserving my local component state?**

HMR state preservation comes with a number of gotchas! It has been disabled by default in both `svelte-hmr` and `@sveltejs/vite-plugin-svelte` due to its often surprising behavior. You can read the details [here](https://github.com/sveltejs/svelte-hmr/tree/master/packages/svelte-hmr#preservation-of-local-state).

If you have state that's important to retain within a component, consider creating an external store which would not be replaced by HMR.

```js
// store.js
// An extremely simple external store
import { writable } from 'svelte/store'
export default writable(0)
```
