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

test('parsePuzzle throws when window.gameData is absent', () => {
  // Has printDate and sides but NOT anchored to window.gameData
  assert.throws(
    () => parsePuzzle('<script>var other = {"printDate":"2026-02-19","sides":["RLU","CNA","EHI","SZQ"]}</script>'),
    /Could not find puzzle data/
  );
});

test('parsePuzzle ignores printDate appearing before window.gameData', () => {
  const html =
    '"printDate":"2000-01-01"' +
    'window.gameData = {"printDate":"2026-02-19","sides":["RLU","CNA","EHI","SZQ"]}';
  const { printDate } = parsePuzzle(html);
  assert.equal(printDate, '2026-02-19');  // must NOT be 2000-01-01
});
