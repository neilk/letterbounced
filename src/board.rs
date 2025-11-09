use crate::dictionary::Dictionary;
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::{self, BufRead, BufReader};
use std::path::Path;
use std::sync::Arc;
use thiserror::Error;

const SIDES_DISPLAY: &[&str] = &["top", "right", "left", "bottom"];

#[derive(Debug, Error)]
pub enum BoardError {
    #[error("Board must contain exactly 4 sides, found {0}")]
    InvalidSideCount(usize),

    #[error("All sides must have the same length. The {side1} side has length {len1} but the {side2} side has length {len2}")]
    UnequalSideLengths {
        side1: String,
        len1: usize,
        side2: String,
        len2: usize,
    },

    #[error("Invalid character '{ch}' on the {side} side. Only lowercase ASCII letters are allowed")]
    InvalidCharacter { ch: char, side: String },

    #[error("Duplicate letter '{letter}' found {location}")]
    DuplicateLetter { letter: char, location: String },

    #[error("Empty sides are not allowed")]
    EmptySide,

    #[error("I/O error: {0}")]
    Io(#[from] io::Error),
}

#[derive(Debug, Clone)]
pub struct Board {
    pub sides: Vec<String>,
    pub digraphs: HashSet<String>,
}

impl Board {
    pub fn from_sides(sides: Vec<String>) -> Result<Self, BoardError> {
        Self::validate_sides_structure(&sides)?;
        Self::validate_sides_content(&sides)?;

        let digraphs = Self::playable_digraphs(&sides);
        let game = Board { sides, digraphs };

        Ok(game)
    }

    pub fn from_path<P: AsRef<Path>>(path: P) -> Result<Self, BoardError> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        let sides: Vec<String> = reader
            .lines()
            .map_while(Result::ok)
            .map(|s| s.to_lowercase())
            .collect();

        Self::from_sides(sides)
    }

    fn validate_sides_structure(sides: &[String]) -> Result<(), BoardError> {
        if sides.len() != 4 {
            return Err(BoardError::InvalidSideCount(sides.len()));
        }

        if sides.iter().any(|side| side.is_empty()) {
            return Err(BoardError::EmptySide);
        }

        let first_len = sides[0].len();
        for (i, side) in sides.iter().enumerate() {
            if side.len() != first_len {
                return Err(BoardError::UnequalSideLengths {
                    side1: SIDES_DISPLAY[0].to_string(),
                    len1: first_len,
                    side2: SIDES_DISPLAY[i].to_string(),
                    len2: side.len(),
                });
            }
        }

        Ok(())
    }

    fn validate_sides_content(sides: &[String]) -> Result<(), BoardError> {
        let mut seen_chars: HashMap<char, usize> = HashMap::new();

        for (side_num, side) in sides.iter().enumerate() {
            for c in side.chars() {
                if !c.is_ascii_lowercase() {
                    return Err(BoardError::InvalidCharacter {
                        ch: c,
                        side: SIDES_DISPLAY[side_num].to_string(),
                    });
                }

                if let Some(previous_side) = seen_chars.insert(c, side_num) {
                    let location = if previous_side == side_num {
                        format!("on the {} side", SIDES_DISPLAY[side_num])
                    } else {
                        format!(
                            "on the {} side and the {} side",
                            SIDES_DISPLAY[previous_side], SIDES_DISPLAY[side_num]
                        )
                    };
                    return Err(BoardError::DuplicateLetter { letter: c, location });
                }
            }
        }

        Ok(())
    }

    fn playable_digraphs(sides: &[String]) -> HashSet<String> {
        let mut digraphs = HashSet::new();
        for (i, side) in sides.iter().enumerate() {
            for c1 in side.chars() {
                for (j, other_side) in sides.iter().enumerate() {
                    if i != j {
                        for c2 in other_side.chars() {
                            let digraph = format!("{}{}", c1, c2);
                            digraphs.insert(digraph);
                        }
                    }
                }
            }
        }
        digraphs
    }

    pub fn playable_dictionary(&self, dictionary: &Dictionary) -> Dictionary {
        // Build a set of usable digraph indices by checking which dictionary digraphs are playable on this board
        let usable_digraph_indices: HashSet<u16> = dictionary.root_digraph_strings
            .iter()
            .enumerate()
            .filter_map(|(idx, digraph_str)| {
                if self.digraphs.contains(digraph_str) {
                    // Safe: maximum possible digraphs is 26×26=676, well within u16
                    #[allow(clippy::cast_possible_truncation)]
                    Some(idx as u16)
                } else {
                    None
                }
            })
            .collect();

        // Filter words to only those whose digraph indices are all usable
        let playable_words: Vec<Arc<_>> = dictionary
            .words
            .iter()
            .filter(|word| {
                word.digraph_indices.iter().all(|&idx| 
                    usable_digraph_indices.contains(&idx)
                )
            })
            .cloned()
            .collect();

        // Build the valid digraphs set from playable words
        let mut valid_digraphs = HashSet::new();
        for word in &playable_words {
            for &idx in &word.digraph_indices {
                valid_digraphs.insert(dictionary.root_digraph_strings[idx as usize].clone());
            }
        }

        Dictionary {
            words: playable_words,
            digraphs: valid_digraphs,
            root_digraph_strings: dictionary.root_digraph_strings.clone(),
            root_digraph_to_index: dictionary.root_digraph_to_index.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dictionary::Dictionary;

    fn strs_to_vec_strings(strs: &[&str]) -> Vec<String> {
        strs.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn test_playable_dictionary_digraphs() {

        // This represents, for our tests, all the possible words in the world
        let words = &["exfoliating", "monologue", "fungi", "exam", "text", "gym", "gulf", "zing"];
        let dictionary = Dictionary::from_strings(
            strs_to_vec_strings(words)
        );
        assert!(dictionary.digraphs.contains("ex"));
        assert!(dictionary.digraphs.contains("og"));
        assert!(dictionary.digraphs.contains("gu"));
        assert!(dictionary.digraphs.contains("fu"));
        assert!(dictionary.digraphs.contains("xt"));
        assert!(dictionary.digraphs.contains("zi"));
        assert!(!dictionary.digraphs.contains("ou")); // not in any word

        // But on this board...
        let board = Board::from_sides(strs_to_vec_strings(&["otx", "gmi", "fle", "aun"])).unwrap();

        // What digraphs are playable?
        let playable = board.playable_dictionary(&dictionary);
        assert!(playable.digraphs.contains("ex"));  // in EXAM and EXFOLIATING, and possible on the board.
        assert!(playable.digraphs.contains("og"));  // in MONOLOGUE, and possible on the board.
        assert!(playable.digraphs.contains("gu")); // in MONOLOGUE, and possible on the board. Also in GULF, which is not possible, but we have at least one.

        assert!(!playable.digraphs.contains("fu")); // The only word with FU is FUNGI. FU is possible, but on this board GI is same-side. 
                                                    // Therefore FUNGI is not playable, so FU is not a valid digraph for this board.

        assert!(!playable.digraphs.contains("xt"));  // XT is not possible on this board - same side
        
        assert!(!playable.digraphs.contains("zi"));  // Z is not on the board at all

        assert!(!playable.digraphs.contains("ou")); // still not in any word

    }

    #[test]
    fn test_playable_dictionary_filters_words_with_invalid_letters() {
        // No 'd' on the board
        let board = Board::from_sides(strs_to_vec_strings(&["otx", "gmi", "fle", "aun"])).unwrap();

        let impossible_words = &["demagogue"];
        let possible_words = &["exfoliating", "monologue"];
        let all_words = &[&impossible_words[..], &possible_words[..]].concat();

        let dictionary = Dictionary::from_strings(
            strs_to_vec_strings(all_words)
        );
        let playable = board.playable_dictionary(&dictionary);

        for word in impossible_words.iter() {
            assert!(!playable.words.iter().any(|w| &w.word == word),
                    "Word '{}' should not be playable", word);
        }

        for word in possible_words.iter() {
            assert!(playable.words.iter().any(|w| &w.word == word),
                    "Word '{}' should be playable", word);
        }
    }

    #[test]
    fn test_playable_dictionary_filters_words_with_same_side_digraphs() {
        let board = Board::from_sides(strs_to_vec_strings(&["otx", "gmi", "fle", "aun"])).unwrap();

        let impossible_words = &["gin", "mingle"];
        let possible_words = &["exfoliating", "monologue"];
        let all_words = &[&impossible_words[..], &possible_words[..]].concat();

        let dictionary = Dictionary::from_strings(
            strs_to_vec_strings(all_words)
        );
        let playable = board.playable_dictionary(&dictionary);

        for word in impossible_words.iter() {
            assert!(!playable.words.iter().any(|w| w.word == *word),
                    "Word '{}' should not be playable", word);
        }

        for word in possible_words.iter() {
            assert!(playable.words.iter().any(|w| w.word == *word),
                    "Word '{}' should be playable", word);
        }
    }

    #[test]
    fn test_validate_sides_content_rejects_non_ascii() {
        let result = Board::from_sides(strs_to_vec_strings(&["otx", "gmi", "fl3", "aun"]));
        match result {
            Err(BoardError::InvalidCharacter { ch, side }) => {
                assert_eq!(ch, '3');
                assert_eq!(side, "left");
            }
            _ => panic!("Expected InvalidCharacter error, got: {:?}", result),
        }
    }

    #[test]
    fn test_validate_normal_board() {
        let result = Board::from_sides(strs_to_vec_strings(&["otx", "gmi", "fle", "aun"]));
        assert!(result.is_ok());
    }

    #[test]
    fn test_rejects_duplicate_on_different_sides() {
        let result = Board::from_sides(strs_to_vec_strings(&["otx", "gmi", "fle", "tun"]));
        match result {
            Err(BoardError::DuplicateLetter { letter, location }) => {
                assert_eq!(letter, 't');
                assert!(location.contains("top"));
                assert!(location.contains("bottom"));
            }
            _ => panic!("Expected DuplicateLetter error, got: {:?}", result),
        }
    }

    #[test]
    fn test_validate_sides_content_rejects_duplicate_on_same_side() {
        let result = Board::from_sides(strs_to_vec_strings(&["ott", "gmi", "fle", "aun"]));
        match result {
            Err(BoardError::DuplicateLetter { letter, location }) => {
                assert_eq!(letter, 't');
                assert!(location.contains("top"));
                assert!(!location.contains("and"), "Should not mention multiple sides for same-side duplicate");
            }
            _ => panic!("Expected DuplicateLetter error, got: {:?}", result),
        }
    }

    #[test]
    fn test_validate_zero_length_side() {
        let result = Board::from_sides(strs_to_vec_strings(&["otx", "gmi", "fle", ""]));
        match result {
            Err(BoardError::EmptySide) => {
                // Success - got the expected error
            }
            _ => panic!("Expected EmptySide error, got: {:?}", result),
        }
    }

    #[test]
    fn test_validate_non_equal_length_sides() {
        let result = Board::from_sides(strs_to_vec_strings(&["otx", "gmi", "fle", "aunz"]));
        match result {
            Err(BoardError::UnequalSideLengths { side1, len1, side2, len2 }) => {
                assert_eq!(side1, "top");
                assert_eq!(len1, 3);
                assert_eq!(side2, "bottom");
                assert_eq!(len2, 4);
            }
            _ => panic!("Expected UnequalSideLengths error, got: {:?}", result),
        }
    }

    #[test]
    fn test_playable_digraphs() {
        let sides = strs_to_vec_strings(&["ab", "cd", "ef", "gh"]);
        let board = Board::from_sides(sides).unwrap();
        let expected_digraphs: HashSet<String> = vec![
            "ac", "ad", "ae", "af", "ag", "ah",
            "bc", "bd", "be", "bf", "bg", "bh",
            "ca", "cb", "ce", "cf", "cg", "ch",
            "da", "db", "de", "df", "dg", "dh",
            "ea", "eb", "ec", "ed", "eg", "eh",
            "fa", "fb", "fc", "fd", "fg", "fh",
            "ga", "gb", "gc", "gd", "ge", "gf",
            "ha", "hb", "hc", "hd", "he", "hf",
        ].into_iter().map(String::from).collect();

        assert_eq!(board.digraphs, expected_digraphs);
    }

}
