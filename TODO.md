# TODO - Boxchar Development

## BFS vs DFS Analysis (Completed)

**Status**:  Completed - BFS implementation added to solver.rs

**Key Findings**:
- BFS can be implemented but has fundamental memory challenges for this problem type
- DFS remains superior due to call stack efficiency and natural backtracking
- Both algorithms now find identical solution sets
- Performance: DFS ~47ms vs BFS ~299ms for 100 solutions

**Problem Classification**: Letter Boxed is a **Constraint Satisfaction Problem** with combinatorial enumeration, not a traditional graph search problem.

## Dynamic Index Optimization Ideas

**Core Concept**: Build bitmap-indexed lookup tables dynamically during search to enable faster completion detection.

**Original Idea**:
- Index words by bitmap coverage: `word_index[bit_position] = Vec<word_index>`
- Extend to N-word partial solutions for instant completion lookup
- Build index during search rather than preprocessing

**Refined Approach - 2-Word Cache**:
- Limit to 2-word sequences only (bounded memory: ~250K max entries)
- Cache `HashMap<(missing_bits, last_char), Vec<(word1_idx, word2_idx)>>`
- Enable early pruning: "Can any 2-word sequence complete from here?"

**Status**: Theoretical - not yet implemented

## Vocabulary Restriction Strategy

**Key Insight**: Real Letter Boxed solutions use 5-7 words, but humans work with restricted vocabularies.

**Proposed Tiered Approach**:
1. **High-frequency vocabulary** (using Google NGrams data):
   - Search for 5-7 word solutions (human-realistic)
   - Smaller search space due to vocabulary restriction
   - Representative of actual human play

2. **Full vocabulary** (including rare words):
   - Search for 2-3 word solutions only
   - Leverages obscure words humans wouldn't know
   - Computationally feasible due to length restriction

**Implementation Plan**:
- Sort wordlist by frequency (most frequent first)
- Apply frequency cutoff to create "common words" subset
- Run dual solving strategy: long solutions with common words, short solutions with full dictionary

**Status**: Ready for implementation - frequency data available from Google NGrams

## Current Solver Optimizations

**Already Implemented**:
- Constraint propagation via `words_by_first_letter` index
- Bitmap-based letter coverage for fast set operations
- Early termination when solution limit reached
- Backtracking with pruning based on target word length

**Next Steps**:
1. Implement vocabulary restriction using frequency data
2. Consider dynamic 2-word caching for high-frequency vocabulary tier
3. Benchmark memory vs. computation tradeoffs

**Useful references**:

1. https://github.com/TheAlgorithms/Rust/blob/master/src/graph/breadth_first_search.rs

