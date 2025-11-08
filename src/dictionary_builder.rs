use clap::Parser;
use std::cmp::{min, Ordering};
use std::fs::File;
use std::io::{BufRead, BufReader, Lines, Result};
use std::path::Path;

/**
 * Build the standard word-list for boxchar, which will be a list of words which are playable, along with
 * how frequent they are in english. The word-list will then be sorted by frequency, which will make it
 * easier to display "good" solutions first.
 *
 * We want to create the word list from two sources, which are both large text files.
 *    - the collins scrabble words, a newline-delimited text file, one word per line, e.g.
 *          AA
 *          AAH
 *          AAHED
 *          AAHING
 *          AAHS
 *    - a dump from google ngrams, a tab-separated newline-delimited text file, with integers representing
 *      how frequent the word is. Larger is more frequent. The largest number here is ~ 2**36
 *          a       14219615690
 *          a!      196012
 *          a"      84
 *          a'      47713
 *
 * We will iterate through both files simultaneously, outputing lines as appropriate, e.g.
 *          aba 114620
 *          abac 5914
 *          abacas 423
 *          abaci 41132
 *          aback 1138210
 *
 * We expect the user to then sort the file appropriately with shell tools, e.g.
 *     $ cargo run dictionary-builder -- --frequencies data/google-ngrams-words-all.txt > /tmp/wordlist.txt
 *     $ sort -k 2,2rn -k 1 /tmp/wordlist.txt > data/wordlist.txt
 *
 */

#[derive(Parser)]
#[command(name = "dictionary-builder")]
#[command(
    about = "Builds the dictionary wordlist for Boxchar from Google NGrams and the Scrabble dictionary"
)]
struct Args {
    #[arg(long)]
    frequencies: String,

    #[arg(long, default_value = "data/collins-scrabble-words-2019.txt")]
    scrabble: String,
}

const MINIMUM_LENGTH: usize = 3;

/**
 * Word has to be of minimum length, and have no immediately doubled letters. BUT is okay, BUTT is not.
 * It also has to be all lowercase a-z letters, but we assume the Scrabble dictionary has that property already.
 */
fn is_playable_word(word: &str) -> bool {
    if word.len() < MINIMUM_LENGTH {
        return false;
    }

    word.chars()
        .try_fold(
            '\0',
            |prev, curr| {
                if prev == curr {
                    None
                } else {
                    Some(curr)
                }
            },
        )
        .is_some()
}

fn path_string_to_line_iterator(path_string: &str) -> Result<Lines<BufReader<File>>> {
    let path = Path::new(&path_string);
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let lines = reader.lines();
    Ok(lines)
}

fn main() -> std::io::Result<()> {
    env_logger::init();
    let args = Args::parse();

    let mut scrabble_lines = path_string_to_line_iterator(&args.scrabble)?;
    let mut frequencies_lines = path_string_to_line_iterator(&args.frequencies)?;

    let mut frequencies_line_current = frequencies_lines.next();
    let mut scrabble_line_current = scrabble_lines.next();

    // Iterate through both of these very large files at once
    while let (Some(frequencies_line), Some(scrabble_line)) =
        (&frequencies_line_current, &scrabble_line_current)
    {
        let scrabble_word: String = scrabble_line.as_ref().unwrap().clone().to_lowercase();
        let mut frequencies_split = frequencies_line.as_ref().unwrap().split_whitespace();
        let frequencies_word: &str = frequencies_split.next().unwrap();

        // The largest frequency in this file is about 2**35, so u64 should do it.
        let frequency: u64 = frequencies_split.next().unwrap().parse().unwrap();
        // However, to save a few bytes later when we pack it, we're going to assume the maximum "frequency_score" is just 31.
        // There are only a few super-short words which are above 31 anyway.
        let frequency_score = min(frequency.ilog2(), 31);

        match frequencies_word.cmp(&scrabble_word) {
            Ordering::Equal => {
                if is_playable_word(frequencies_word) {
                    println!("{} {}", frequencies_word, frequency_score);
                }
                frequencies_line_current = frequencies_lines.next();
                scrabble_line_current = scrabble_lines.next();
            }
            Ordering::Less => {
                frequencies_line_current = frequencies_lines.next();
            }
            Ordering::Greater => {
                scrabble_line_current = scrabble_lines.next();
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_playable_word() {
        // adjacent repeated letters
        assert!(!is_playable_word("peer"));
        assert!(!is_playable_word("book"));
        assert!(!is_playable_word("coffee"));
        assert!(!is_playable_word("llama"));

        // too short
        assert!(!is_playable_word("an"));
        assert!(!is_playable_word(""));

        // okay
        assert!(is_playable_word("dojo"));
        assert!(is_playable_word("word"));
    }
}
