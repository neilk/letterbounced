# Letter Bounced 

A solver for the New York Times word puzzle, "Letter Boxed". [Try it out!](https://neilk.github.io/letterbounced/)

![Screenshot of the Letter Bounced web app](solver-web.png)

## Why?

The New York Times puzzle page is very popular! Yet, the existing solvers that I know of suck.

* Hard to use
* Slow
* Only suggest "best" answers with ridiculously rare words
* Give redundant answers
* Grind to a halt when the solution is more than two words
* Weren't written in Rust

I got obsessed with this game about a year ago and I kept thinking of ways to write a fast solver. Here's my attempt,
and not uncoincidentally it's my first real Rust project.

## Notes on the algorithm

See [algorithm notes](docs/algorithm.md).

## What is Letter Boxed?

Letter Boxed puzzles are a set of letters in a box shape. Players must connect all the letters in the puzzle 
with a chain of valid words, as in the following screenshot.

![Screenshot of NYTimes Letter Boxed](NY_Times_Letter_Boxed.png)

## Game Rules

1. **Four-sided puzzle**: Letters are arranged on four sides of a square. (Though, Letter Bounced may allow other shapes)
2. **No same-side connections**: You cannot connect two letters from the same side. Think of it as bouncing between sides.
3. **Word chaining**: Each new word must start with the last letter of the previous word
4. **Complete coverage**: All letters must be used across your word sequence

There is no score in the New York Times' version of Letter Boxed, but some puzzles are harder than 
others. Sometimes there are hundreds of solutions, and sometimes there is only one. Skilled players try 
to complete the puzzle in fewer words.

### Example

Given the puzzle:
```
JGH NVY EID ORP
```

The only two-word solution is: `DOJO-OVERHYPING`

A possible three-word solution is: `DOVE-ENJOYING-GRYPHON`

Note how each letter hops to a different side, and the words are connected by their first/last letters.

## Installation

Make sure you have Rust installed, then:

```bash
git clone git@github.com:neilk/letterbounced.git
cd letterbounced
cargo build --release
```

This produces the `letter-bounced` binary in `target/release/`.

## Command-line usage

```bash
letter-bounced [OPTIONS] [BOARD_SPEC]
```

### Specifying the board

You can specify the board in two ways:

#### 1. Positional argument (comma-separated)

```bash
cargo run --release --bin letter-bounced -- "YFA,OTK,LGW,RNI"
```

Requirements:

- Only letters (A-Z, a-z) and commas allowed
- No spaces permitted
- Must have exactly 4 sides with equal lengths

#### 2. File path (`--board`)

```bash
cargo run --release --bin letter-bounced -- --board data/board.txt
```

The board file should contain 4 lines, each representing one side:

```
YFA
OTK
LGW
RNI
```

Board files must have all sides the same length, and no duplicate letters across all sides.

### Options

| Option | Description | Default | Required |
|--------|-------------|---------|----------|
| `BOARD_SPEC` | Board as comma-separated sides (e.g., "ABC,DEF,GHI,JKL") | - | Either this or `--board` |
| `--board <PATH>` | Path to board file | - | Either this or `BOARD_SPEC` |
| `--dictionary <PATH>` | Path to dictionary file | `data/dictionary.txt` | No |
| `--max-solutions <N>` | Maximum solutions to print (max 65535) | `500` | No |
| `--help` | Show help information | - | No |

### Example run

```bash
$ cat data/board.txt 
YFA
OTK
LGW
RNI

$ time ./target/release/letter-bounced --board=data/board.txt --max-solutions=10
forklift-twangy
know-wolf-fragility
know-waif-fragility
now-wakf-fragility
work-kif-flagrantly
work-kif-fragrantly
work-kalif-flagrantly
work-kalif-fragrantly
work-kaif-flagrantly
work-kaif-fragrantly

./target/release/letter-bounced --board=data/board.txt --max-solutions=10  0.90s user 0.09s system 95% cpu 1.037 total
```

### Error cases

The application will exit with an error if

- There is no clear board specification, from file or command line
- Board specification contains invalid characters (anything other than A-Z, a-z, comma)
- Board file cannot be read or has invalid format
- Dictionary file cannot be read

## Web Application

The web application is built with Svelte and powered by Rust/WASM.


### Building the WASM Package

First, build the WASM package from the Rust code (run from repository root):

```bash
./build-web.sh
```

This creates the WASM files in `web/svelte-app/src/pkg/` and copies the dictionary to `web/svelte-app/public/`.

### Development Mode

Run the Svelte development server with hot module replacement:

```bash
cd web/svelte-app
npm install  # First time only
npm run dev
```

Opens at http://localhost:8000/

### Production Build

Build optimized static files for deployment:

```bash
cd web/svelte-app
npm run build
```

- Outputs to `web/svelte-app/dist/` directory
- App bundle: ~21 KB gzipped (46 KB JS + 11 KB CSS + 7 KB solver worker uncompressed)
- Plus 87 KB WASM (39 KB gzipped) and the 2.2 MB dictionary (700 KB gzipped)
- Can be deployed to any static hosting (GitHub Pages, Netlify, Vercel, etc.)

### Preview Production Build

Test the production build locally (must be run after `npm run build`):

```bash
cd web/svelte-app
npm run preview
```

Opens at http://localhost:4173/

### Tests

Playwright tests start the dev server themselves:

```bash
cd web/svelte-app
npm test
```

### Today's New York Times puzzle

The app never contacts nytimes.com from the browser. Instead,
`.github/workflows/scrape-puzzle.yml` runs every four hours, scrapes the puzzle with
`scripts/scrape_puzzle.mjs`, and commits it to the `gh-pages` branch as
`puzzles/YYYY-MM-DD.json`. The "Today's New York Times" menu item just fetches that
static file. If today's file isn't there yet, it falls back to yesterday's.

Locally there is no `gh-pages` branch to read, so `npm run dev` scrapes today's puzzle
into `web/svelte-app/public/puzzles/` first, via the `predev` hook. That step is skipped
when `$CI` is set — CI must not depend on nytimes.com being up — and a failed scrape only
warns, so the dev server still starts when you're offline. To fetch by hand:

```bash
cd web/svelte-app && npm run scrape
```

### Deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds the WASM and the Svelte
app, runs the Playwright tests, then copies `dist/` over the `gh-pages` branch and pushes.
GitHub Pages serves that branch directly.

The copy is deliberately additive rather than a clean replace, so the `puzzles/` JSON that
`scrape-puzzle.yml` commits to the same branch survives a deploy. It also means a newly
scraped puzzle goes live within about a minute, without rebuilding the app.

The Pages source must stay set to "Deploy from a branch" → `gh-pages` / `(root)`. Otherwise,
rebuilds will not modify the public-facing website.

## Dictionary Format

Dictionary files are plain text, should contain one word per line, with two whitespace-separated tokens per line:

- a word in lowercase,
- a frequency score

The file should be sorted with most frequent words first.

The script `./build-dictionary.sh` will construct this for you, given the included Collins Scrabble Words, and a sorted list 
of the frequency of all words in Google NGrams. That frequency file is not provided in this repository.


## License

Copyright Neil Kandalgaonkar, 2025-2026. 

This software is *NOT* freely redistributable.

Screenshot by The New York Times - The New York Times Games mobile app, sourced from [Wikipedia's File:NY Times Letter Boxed.png](https://en.wikipedia.org/w/index.php?curid=76415365).
