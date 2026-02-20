import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NYT_URL = 'https://www.nytimes.com/puzzles/letter-boxed';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/120.0.0.0 Safari/537.36';

export function parsePuzzle(html) {
  const gameDataIdx = html.indexOf('window.gameData');
  if (gameDataIdx === -1) {
    throw new Error('Could not find puzzle data in page');
  }
  const snippet = html.slice(gameDataIdx, gameDataIdx + 5000);

  const dateMatch = snippet.match(/"printDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"/);
  const sidesMatch = snippet.match(/"sides"\s*:\s*(\[[^\]]+\])/);
  if (!dateMatch || !sidesMatch) {
    throw new Error('Could not find puzzle data in page');
  }

  let sides;
  try {
    sides = JSON.parse(sidesMatch[1]);
  } catch {
    throw new Error('Could not parse sides array from puzzle data');
  }
  return { printDate: dateMatch[1], sides };
}

async function main() {
  const outputDir = process.argv[2] || 'puzzles';
  mkdirSync(outputDir, { recursive: true });

  const response = await fetch(NYT_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) {
    console.error(`HTTP error: ${response.status}`);
    process.exit(1);
  }

  let printDate, sides;
  try {
    ({ printDate, sides } = parsePuzzle(await response.text()));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const outputFile = join(outputDir, `${printDate}.json`);
  if (existsSync(outputFile)) {
    console.log(`Puzzle for ${printDate} already exists, skipping.`);
    return;
  }

  writeFileSync(outputFile, JSON.stringify({ sides }));
  console.log(`Wrote puzzle for ${printDate}: ${JSON.stringify(sides)}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(e => { console.error(e); process.exit(1); });
}
