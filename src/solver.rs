use crate::board::Board;
use crate::dictionary::{Dictionary, Word};
use std::collections::HashMap;
use std::fmt;
use std::cmp::min;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Debug, Clone, PartialEq)]
pub struct Solution {
    pub words: Vec<Arc<Word>>,
    pub score: usize,
}

impl Solution {
    pub fn new(words: Vec<Arc<Word>>) -> Self {
        let min_frequency: usize = words.iter().fold(256usize, |acc, w| {
            // frequency is i8, but represents 0-31 range
            let freq = usize::try_from(w.frequency).unwrap_or(0);
            min(acc, freq)
        });
        let score: usize = (min_frequency * 10) / words.len();
        Solution { words, score }
    }

    /// Returns all redactable subsequences of this solution as vectors of indices.
    /// A subsequence is redactable if:
    /// 1. It includes the head of the solution (first word can be removed), OR
    /// 2. It doesn't include the head, but forms a valid word chain (first and last letters match across the gap)
    ///
    /// All redactions must be shorter than the original solution.
    pub fn redactable_subsequences(&self) -> Vec<Vec<usize>> {
        let n = self.words.len();
        if n <= 1 {
            return vec![];
        }

        let mut redactions = Vec::new();

        // Generate all non-empty proper subsequences (shorter than original)
        // Use bitmask to represent which words to include
        let num_subsets = 1 << n;
        for mask in 1..num_subsets {
            // Skip if this includes all words (not a proper subsequence)
            if mask == num_subsets - 1 {
                continue;
            }

            let mut indices = Vec::new();
            for i in 0..n {
                if (mask & (1 << i)) != 0 {
                    indices.push(i);
                }
            }

            // Check if this subsequence is redactable
            if indices.is_empty() {
                continue;
            }

            // Rule 1: Includes the head (index 0 not set in mask means head is removed)
            let includes_head = (mask & 1) == 0;

            // Rule 2: Check if it forms a valid chain (if head is included)
            let forms_valid_chain = if !includes_head {
                // Check that consecutive words in the subsequence form valid chains
                let mut valid = true;
                for i in 0..indices.len() - 1 {
                    let last_char = self.words[indices[i]].word.chars().last();
                    let first_char = self.words[indices[i + 1]].word.chars().next();
                    if last_char != first_char {
                        valid = false;
                        break;
                    }
                }
                valid
            } else {
                true
            };

            if includes_head || forms_valid_chain {
                redactions.push(indices);
            }
        }

        redactions
    }
}

impl fmt::Display for Solution {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = self.words
            .iter()
            .map(|w| w.word.as_str())
            .collect::<Vec<&str>>()
            .join("-");
        write!(f, "{}", s)
    }
}

struct WordBitmap {
    word: Arc<Word>,
    bitmap: u32,
}

pub struct Solver {
    word_bitmaps: Vec<WordBitmap>,
    words_by_first_letter: HashMap<char, Vec<usize>>,
    all_letters_mask: u32,
    max_solutions: usize, // this is usize for convenience in comparisons to length(), but set from u16
}

impl Solver {
    pub fn new(board: Board, dictionary: &Dictionary, max_solutions: u16) -> Self {
        // Create letter-to-bit mapping
        let mut letter_to_bit = HashMap::new();
        let mut bit_index = 0;
        for side in &board.sides {
            for ch in side.chars() {
                letter_to_bit.insert(ch, 1 << bit_index);
                bit_index += 1;
            }
        }

        // Calculate mask for all letters, e.g. for 8 letters, this is 0b11111111
        let all_letters_mask = 2u32.pow(bit_index) - 1;

        // Create word bitmaps for all words playable
        let board_dictionary = board.playable_dictionary(dictionary);
        let word_bitmaps: Vec<WordBitmap> = board_dictionary
            .words
            .iter()
            .map(|word| {
                let bitmap = word.word.chars().fold(0, |acc, ch| {
                    acc | letter_to_bit.get(&ch).copied().unwrap_or(0)
                });
                WordBitmap {
                    word: Arc::clone(word),  // Cheap Arc clone - just increments ref count
                    bitmap,
                }
            })
            .collect();

        // Index words by first letter
        let mut words_by_first_letter: HashMap<char, Vec<usize>> = HashMap::new();
        for (i, word_bitmap) in word_bitmaps.iter().enumerate() {
            if let Some(first_char) = word_bitmap.word.word.chars().next() {
                words_by_first_letter.entry(first_char).or_default().push(i);
            }
        }

        Solver {
            word_bitmaps,
            words_by_first_letter,
            all_letters_mask,
            max_solutions: max_solutions.into(),
        }
    }

    /// Check if a solution is redundant by examining its redactable subsequences.
    /// A solution is redundant if any of its redactions also covers all letters.
    fn is_solution_redundant(&self, solution: &Solution) -> bool {
        let redaction_indices = solution.redactable_subsequences();

        for indices in redaction_indices {
            // Compute the combined bitmap for this redaction by indexing into solution
            let mut combined_bitmap = 0u32;
            for &idx in &indices {
                let word = &solution.words[idx];
                // Find the bitmap for this word
                if let Some(wb) = self.word_bitmaps.iter().find(|wb| wb.word == *word) {
                    combined_bitmap |= wb.bitmap;
                }
            }

            // If this redaction covers all letters, the original solution is redundant
            if combined_bitmap == self.all_letters_mask {
                return true;
            }
        }

        false
    }

    pub fn solve(&self) -> Vec<Solution> {
        self.solve_cancellable(None)
    }

    /// Solve with cancellation support
    ///
    /// The `cancel_flag` parameter allows external cancellation of the solve operation.
    /// When the flag is set to true, the solver will stop as soon as possible.
    pub fn solve_cancellable(&self, cancel_flag: Option<Arc<AtomicBool>>) -> Vec<Solution> {
        let mut solutions = Vec::new();

        // Try solutions of each exact length
        for target_words in 1..=4 {
            let mut current_path = Vec::new();
            let cancelled = !self.search_recursive(
                &mut current_path,
                0,
                None,
                &mut solutions,
                target_words,
                cancel_flag.as_ref(),
            );

            if cancelled || solutions.len() >= self.max_solutions {
                break;
            }
        }

        // Sort by score descending
        solutions.sort_by(|a, b| b.score.cmp(&a.score));

        // Ensure we don't exceed max_solutions after sorting
        solutions.truncate(self.max_solutions);

        solutions
    }

    fn search_recursive(
        &self,
        current_path: &mut Vec<Arc<Word>>,
        covered_bitmap: u32,
        last_char: Option<char>,
        solutions: &mut Vec<Solution>,
        target_words: usize,
        cancel_flag: Option<&Arc<AtomicBool>>,
    ) -> bool // Returns true if not cancelled
    {
        // Check for cancellation
        if let Some(flag) = cancel_flag {
            if flag.load(Ordering::Relaxed) {
                return false; // Cancelled
            }
        }

        // Early termination if we have enough solutions
        if solutions.len() >= self.max_solutions {
            return true;
        }

        // Check if we've found a complete solution of the target length
        if covered_bitmap == self.all_letters_mask && current_path.len() == target_words {
            let solution = Solution::new(current_path.clone());
            if !self.is_solution_redundant(&solution) {
                solutions.push(solution);
                return true;
            }
        }

        // Don't go deeper if we've hit the word limit
        if current_path.len() >= target_words {
            return true;
        }

        // Determine which words we can try next
        let word_indices: Vec<usize> = if let Some(ch) = last_char {
            // Must start with the last character of the previous word
            self.words_by_first_letter
                .get(&ch).cloned()
                .unwrap_or_default()
        } else {
            // First word - can be any word
            (0..self.word_bitmaps.len()).collect()
        };

        for word_idx in word_indices {
            let word_bitmap = &self.word_bitmaps[word_idx];
            let new_bitmap = covered_bitmap | word_bitmap.bitmap;

            // Only continue if this word adds new letters
            if new_bitmap != covered_bitmap {
                current_path.push(Arc::clone(&word_bitmap.word));  // Cheap Arc clone
                let new_last_char = word_bitmap.word.word.chars().last();

                if !self.search_recursive(
                    current_path,
                    new_bitmap,
                    new_last_char,
                    solutions,
                    target_words,
                    cancel_flag,
                ) {
                    current_path.pop();
                    return false; // Cancelled
                }

                current_path.pop();
            }
        }

        true // Not cancelled
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solution_display() {
        let words = ["word", "ocean", "dojo"];
        let word_strings = words.iter().map(|&s| s.to_string()).collect();
        let dictionary = Dictionary::from_strings(word_strings);
        let solution = Solution::new(vec![
            dictionary.words[0].clone(),
            dictionary.words[2].clone(),
            dictionary.words[1].clone(),
        ]);
        assert_eq!(solution.to_string(), "word-dojo-ocean");
        let single_word = Solution::new(vec![dictionary.words[0].clone()]);
        assert_eq!(single_word.to_string(), "word");
    }

    #[test]
    fn test_redactable_subsequences() {
        let words = ["foxglove", "eye", "equity"];
        let word_strings = words.iter().map(|&s| s.to_string()).collect();
        let dictionary = Dictionary::from_strings(word_strings);

        // Test FOXGLOVE-EYE-EQUITY
        let solution = Solution::new(vec![
            dictionary.words[0].clone(), // foxglove (index 0)
            dictionary.words[1].clone(), // eye (index 1)
            dictionary.words[2].clone(), // equity (index 2)
        ]);

        let redaction_indices = solution.redactable_subsequences();

        // Should include redactions like:
        // - [1, 2] = [EYE, EQUITY] (removes head)
        // - [2] = [EQUITY] (removes head)
        // - [0, 2] = [FOXGLOVE, EQUITY] (valid chain, skips EYE)
        // etc.

        // Helper to check if specific indices are in redactions
        let has_redaction = |expected_indices: Vec<usize>| {
            redaction_indices.iter().any(|r| *r == expected_indices)
        };

        assert!(has_redaction(vec![1, 2]), "Should have [1, 2] = EYE-EQUITY (removes head)");
        assert!(has_redaction(vec![2]), "Should have [2] = EQUITY (removes head)");
        assert!(has_redaction(vec![0, 2]), "Should have [0, 2] = FOXGLOVE-EQUITY (valid chain)");

        // Should NOT include the full solution
        assert!(!has_redaction(vec![0, 1, 2]), "Should not include full solution [0, 1, 2]");
    }

    #[test]
    fn test_redactable_subsequences_single_word() {
        let words = ["foxglove"];
        let word_strings = words.iter().map(|&s| s.to_string()).collect();
        let dictionary = Dictionary::from_strings(word_strings);

        let solution = Solution::new(vec![dictionary.words[0].clone()]);
        let redactions = solution.redactable_subsequences();

        assert_eq!(redactions.len(), 0, "Single word solution should have no redactions");
    }

    #[test]
    fn test_redundancy_filtering() {
        let sides = vec![
            "vyq".to_string(),
            "fig".to_string(),
            "ote".to_string(),
            "xlu".to_string(),
        ];
        let board = Board::from_sides(sides).unwrap();

        let word_strs = ["foxglove", "equity", "eye", "golf", "flog", "glove", "exile", "exit", "tie", "yog"];
        let word_strings = word_strs.iter().map(|&s| s.to_string()).collect();
        let dictionary = Dictionary::from_strings(word_strings);

        let foxglove = &dictionary.words[0];
        let equity = &dictionary.words[1];
        let eye = &dictionary.words[2];
        let golf = &dictionary.words[3];
        let flog = &dictionary.words[4];
        let glove = &dictionary.words[5];
        let exile = &dictionary.words[6];
        let exit = &dictionary.words[7];
        let tie = &dictionary.words[8];
        let yog = &dictionary.words[9];

        let solver = Solver::new(board, &dictionary, 1000);
        let solutions = solver.solve();

        fn has(solutions: &Vec<Solution>, ws: Vec<&Arc<Word>>) -> bool {
            let vec_word_clones: Vec<Arc<Word>> = ws.iter().map(|&w| Arc::clone(w)).collect();
            let solution = Solution::new(vec_word_clones);
            solutions.contains(&solution)
        }
        // Should have unique and interesting solutions
        assert!(has(&solutions, vec![foxglove, equity]), "Should have FOXGLOVE-EQUITY");

        // EXILE is a "redactable" interior sequence, since it begins and ends with the same letter,
        // but removing it means we're missing an X, so it should still be a solution.
        assert!(has(&solutions, vec![flog, glove, exile, equity]), "Should have FLOG-GLOVE-EXILE-EQUITY");
        
        // Should not have solutions which are redundant
        assert!(!has(&solutions, vec![foxglove, eye, equity]), "Should not have FOXGLOVE-EYE-EQUITY");
        assert!(!has(&solutions, vec![foxglove, exit, tie, equity]), "Should not have FOXGLOVE-EXIT-TIE-EQUITY");
        assert!(!has(&solutions, vec![golf, foxglove, equity]), "Should not have GOLF-FOXGLOVE-EQUITY");

        // This should have already have been impossible, the recursive search should have stopped before adding YOG,
        // but we'll just add it here anyway.
        assert!(!has(&solutions, vec![foxglove, equity, yog]), "Should not have FOXGLOVE-EQUITY-YOG");

    }

    #[test]
    fn test_bitmap_coverage() {
        let sides = vec![
            "ab".to_string(),
            "cd".to_string(),
            "ef".to_string(),
            "gh".to_string(),
        ];
        let game = Board::from_sides(sides).unwrap();

        // Create a simple wordlist that includes all the digraphs these words need
        // Since the game is AB/CD/EF/GH, we need valid cross-side digraphs
        let mut valid_digraphs = std::collections::HashSet::new();

        // Add all valid digraphs from the game (cross-side pairs)
        for digraph in &game.digraphs {
            valid_digraphs.insert(digraph.clone());
        }

        // For our test words, we need to pick ones that use valid cross-side digraphs
        // Let's use simpler words that work: "AC" (A->C), "CE" (C->E), etc.
        let test_words = ["ac", "ce", "eg"];
        let test_word_strings = test_words.iter().map(|&s| s.to_string()).collect();
        let dictionary = Dictionary::from_strings(test_word_strings);
        let solver = Solver::new(game, &dictionary, 10);

        // Test that all letters bitmap is correctly calculated
        assert_eq!(solver.all_letters_mask, 0b11111111); // 8 bits for 8 letters

        // Test that word bitmaps are correctly calculated
        if let Some(word_ac) = solver.word_bitmaps.iter().find(|wb| wb.word.word == "AC") {
            // A=bit0, C=bit2, so AC should be 0b00000101
            assert_eq!(word_ac.bitmap, 0b00000101);
        }

        if let Some(word_ce) = solver.word_bitmaps.iter().find(|wb| wb.word.word == "CE") {
            // C=bit2, E=bit4, so CE should be 0b00010100
            assert_eq!(word_ce.bitmap, 0b00010100);
        }

        if let Some(word_eg) = solver.word_bitmaps.iter().find(|wb| wb.word.word == "EG") {
            // E=bit4, G=bit6, so EG should be 0b01010000
            assert_eq!(word_eg.bitmap, 0b01010000);
        }

        // Test that basic bitmap operations work
        assert!(!solver.word_bitmaps.is_empty());
    }
}
