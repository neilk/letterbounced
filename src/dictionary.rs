use std::collections::{HashSet};
use std::fs::File;
use std::io::{self, BufRead, BufReader};
use std::path::Path;

/**
 * Note that we depend on the wordlist already being filtered to words which are
 * playable in our game.
 */

#[derive(Debug, Clone, PartialEq)]
pub struct Word {
    pub word: String,
    pub frequency: i8,
    pub digraphs: HashSet<String>,
}

impl Word {
    /// Extract digraphs (consecutive letter pairs) from a word
    fn extract_digraphs(word: &str) -> HashSet<String> {
        let chars: Vec<char> = word.chars().collect();
        let mut digraphs = HashSet::new();

        for i in 0..chars.len() - 1 {
            let digraph = format!("{}{}", chars[i], chars[i + 1]);
            digraphs.insert(digraph);
        }

        digraphs
    }

    /// Create a new Word with the given word string and frequency
    pub fn new(word: String, frequency: i8) -> Self {
        let digraphs = Self::extract_digraphs(&word);
        Word {
            word,
            frequency,
            digraphs,
        }
    }
}

#[derive(Debug)]
pub struct Dictionary {
    pub words: Vec<Word>,
    pub digraphs: HashSet<String>,
}

impl Dictionary {
    const DEFAULT_FREQUENCY: i8 = 15;
    pub fn from_words(words: Vec<Word>) -> Self {
        let mut valid_digraphs = HashSet::new();

        for word in &words {
            valid_digraphs.extend(word.digraphs.iter().cloned());
        }

        Dictionary {
            words,
            digraphs: valid_digraphs,
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
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_digraphs_simple() {
        let expected_digraphs: HashSet<String> = ["PI", "IR", "RA", "AT", "TE"]
            .iter()
            .map(|s| s.to_string())
            .collect();

        let word = Word::new("PIRATE".to_string(), 15);
        assert_eq!(word.digraphs, expected_digraphs);
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
}

