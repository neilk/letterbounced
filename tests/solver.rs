use boxchar::board::Board;
use boxchar::solver::Solver;
use boxchar::dictionary::{Dictionary, Word};

mod common;
use common::sides_from_strs;

#[test]
fn test_solver_basic() {
    let sides = sides_from_strs(&["yfa", "otk", "lgw", "rni"]);
    let game = Board::from_sides(sides).unwrap();

    // Create a minimal wordlist for testing with high frequency (> 24) for all words
    let words = vec![
        Word::new("forklift".to_string(), 30),
        Word::new("twangy".to_string(), 30),
        Word::new("filtration".to_string(), 30),
        Word::new("nag".to_string(), 30),
        Word::new("gawkily".to_string(), 30),
    ];
    let wordlist = Dictionary::from_words(words);
    let solver = Solver::new(game, &wordlist, 10);
    let solutions = solver.solve();

    assert!(!solutions.is_empty());
    assert!(solutions.len() == 2);
    assert!(solutions.iter().any(|s| s.to_string() == "forklift-twangy"));
    assert!(solutions
        .iter()
        .any(|s| s.to_string() == "filtration-nag-gawkily"));
}
