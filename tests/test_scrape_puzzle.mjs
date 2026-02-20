import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePuzzle } from '../scripts/scrape_puzzle.mjs';

test('parsePuzzle extracts date and sides', () => {
  const html = 'window.gameData = {"printDate":"2026-02-19","sides":["RLU","CNA","EHI","SZQ"],"dictionary":[]}';
  const { printDate, sides } = parsePuzzle(html);
  assert.equal(printDate, '2026-02-19');
  assert.deepEqual(sides, ['RLU', 'CNA', 'EHI', 'SZQ']);
});

test('parsePuzzle throws on missing data', () => {
  assert.throws(
    () => parsePuzzle('<html>no gameData here</html>'),
    /Could not find puzzle data/
  );
});

test('parsePuzzle handles whitespace in JSON', () => {
  const html = 'window.gameData = { "printDate" : "2026-03-01" , "sides" : [ "ABC" , "DEF" , "GHI" , "JKL" ] }';
  const { printDate, sides } = parsePuzzle(html);
  assert.equal(printDate, '2026-03-01');
  assert.deepEqual(sides, ['ABC', 'DEF', 'GHI', 'JKL']);
});
