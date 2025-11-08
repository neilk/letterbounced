use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::{self, BufRead, BufReader};
use std::path::Path;
use std::sync::Arc;
use serde::{Serialize, Deserialize};

/**
 * Note that we depend on the wordlist already being filtered to words which are
 * playable in our game.
 */

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Word {
    pub word: String,
    pub frequency: i8,
    pub digraph_indices: Vec<u8>,
}

impl Word {
    /// Extract digraphs (consecutive letter pairs) from a word
    fn extract_digraphs(word: &str) -> Vec<String> {
        let chars: Vec<char> = word.chars().collect();
        let mut digraphs = Vec::new();

        for i in 0..chars.len() - 1 {
            let digraph = format!("{}{}", chars[i], chars[i + 1]);
            digraphs.push(digraph);
        }

        digraphs
    }

    /// Create a new Word with the given word string and frequency
    /// This version is used when we don't have a digraph index yet (e.g., during Dictionary construction)
    pub fn new(word: String, frequency: i8) -> Self {
        Word {
            word,
            frequency,
            digraph_indices: Vec::new(), // Will be filled by Dictionary
        }
    }

    /// Create a Word with digraph indices already computed
    pub fn with_digraph_indices(word: String, frequency: i8, digraph_to_index: &HashMap<String, u8>) -> Self {
        let digraph_strings = Self::extract_digraphs(&word);
        let digraph_indices: Vec<u8> = digraph_strings
            .iter()
            .filter_map(|d| digraph_to_index.get(d).copied())
            .collect();

        Word {
            word,
            frequency,
            digraph_indices,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Dictionary {
    pub words: Vec<Arc<Word>>,
    pub digraphs: HashSet<String>,
    pub digraph_strings: Vec<String>,  // Master list of all digraphs by index
    pub digraph_to_index: HashMap<String, u8>,  // Map digraph string to index
}

impl Dictionary {
    const DEFAULT_FREQUENCY: i8 = 15;
    pub fn from_words(words: Vec<Word>) -> Self {
        // First pass: collect all unique digraphs from all words
        let mut valid_digraphs = HashSet::new();
        for word in &words {
            let digraph_strings = Word::extract_digraphs(&word.word);
            valid_digraphs.extend(digraph_strings);
        }

        // Build the master digraph index
        let mut digraph_strings: Vec<String> = valid_digraphs.iter().cloned().collect();
        digraph_strings.sort(); // Sort for deterministic ordering

        let digraph_to_index: HashMap<String, u8> = digraph_strings
            .iter()
            .enumerate()
            .map(|(i, s)| (s.clone(), i as u8))
            .collect();

        // Second pass: rebuild words with digraph indices
        let words_with_indices: Vec<Arc<Word>> = words
            .into_iter()
            .map(|w| {
                Arc::new(Word::with_digraph_indices(w.word, w.frequency, &digraph_to_index))
            })
            .collect();

        Dictionary {
            words: words_with_indices,
            digraphs: valid_digraphs,
            digraph_strings,
            digraph_to_index,
        }
    }

    // This is only used for tests, and so it has a fake frequency
    pub fn from_strings(words: Vec<String>) -> Self {
        let word_frequencies: Vec<Word> = words
            .into_iter()
            .map(|w| Word::new(w, Self::DEFAULT_FREQUENCY))
            .collect();
        Self::from_words(word_frequencies)
    }

    fn parse_word_line(line: &str) -> Option<Word> {
        let mut parts = line.trim().split_whitespace();
        match (parts.next(), parts.next()) {
            (Some(word_str), Some(frequency_str)) => match frequency_str.parse::<i8>() {
                Ok(frequency) => Some(Word::new(word_str.to_string(), frequency)),
                Err(_) => None,
            },
            _ => None,
        }
    }

    pub fn from_text(text: &str) -> Self {
        let words: Vec<Word> = text
            .lines()
            .filter_map(Self::parse_word_line)
            .collect();
        Self::from_words(words)
    }

    pub fn from_bytes(data: &[u8]) -> Result<Self, String> {
        // Convert bytes to string and use existing text parsing
        // This provides a foundation for future binary format support
        match std::str::from_utf8(data) {
            Ok(text) => Ok(Self::from_text(text)),
            Err(e) => Err(format!("Invalid UTF-8 data: {}", e)),
        }
    }

    pub fn from_path<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        let words: Vec<Word> = reader
            .lines()
            .map_while(Result::ok)
            .enumerate()
            .filter_map(|(line_num, s)| {
                Self::parse_word_line(&s).or_else(|| {
                    eprintln!("Invalid format on line {}: {}", line_num + 1, s);
                    None
                })
            })
            .collect();
        Ok(Self::from_words(words))
    }

    /// Serialize the dictionary to binary format using bincode
    pub fn to_binary(&self) -> Result<Vec<u8>, String> {
        bincode::serialize(self)
            .map_err(|e| format!("Failed to serialize dictionary: {}", e))
    }

    /// Deserialize the dictionary from binary format using bincode
    pub fn from_binary(data: &[u8]) -> Result<Self, String> {
        bincode::deserialize(data)
            .map_err(|e| format!("Failed to deserialize dictionary: {}", e))
    }
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_digraphs_simple() {
        let expected_digraphs: Vec<String> = vec!["AT".to_string(), "IR".to_string(), "PI".to_string(), "RA".to_string(), "TE".to_string()];

        // Create a dictionary which will build the digraph index
        let dictionary = Dictionary::from_strings(vec!["PIRATE".to_string()]);
        let word = &dictionary.words[0];

        // The word should have 5 digraph indices
        assert_eq!(word.digraph_indices.len(), 5);

        // Resolve the indices back to strings and verify they match
        let mut resolved_digraphs: Vec<String> = word.digraph_indices
            .iter()
            .map(|&idx| dictionary.digraph_strings[idx as usize].clone())
            .collect();
        resolved_digraphs.sort();

        assert_eq!(resolved_digraphs, expected_digraphs);
    }

    #[test]
    fn test_from_bytes_valid_utf8() {
        let text_data = "hello 25\nworld 30\ntest 15\n";
        let bytes = text_data.as_bytes();

        let dictionary = Dictionary::from_bytes(bytes).expect("Should parse valid UTF-8");

        assert_eq!(dictionary.words.len(), 3);
        assert_eq!(dictionary.words[0].word, "hello");
        assert_eq!(dictionary.words[0].frequency, 25);
        assert_eq!(dictionary.words[1].word, "world");
        assert_eq!(dictionary.words[1].frequency, 30);
        assert_eq!(dictionary.words[2].word, "test");
        assert_eq!(dictionary.words[2].frequency, 15);
    }

    #[test]
    fn test_from_bytes_invalid_utf8() {
        let invalid_bytes = vec![0xFF, 0xFE, 0xFD]; // Invalid UTF-8

        let result = Dictionary::from_bytes(&invalid_bytes);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid UTF-8"));
    }

    #[test]
    fn test_binary_serialization_roundtrip() {
        let words = vec![
            Word::new("hello".to_string(), 25),
            Word::new("world".to_string(), 30),
            Word::new("test".to_string(), 15),
        ];
        let original = Dictionary::from_words(words);

        // Serialize to binary
        let binary_data = original.to_binary().expect("Should serialize");

        // Deserialize from binary
        let deserialized = Dictionary::from_binary(&binary_data).expect("Should deserialize");

        // Verify words match
        assert_eq!(original.words.len(), deserialized.words.len());
        for (orig, deser) in original.words.iter().zip(deserialized.words.iter()) {
            assert_eq!(orig.word, deser.word);
            assert_eq!(orig.frequency, deser.frequency);
            assert_eq!(orig.digraph_indices, deser.digraph_indices);
        }

        // Verify digraphs match
        assert_eq!(original.digraphs, deserialized.digraphs);
    }
}

