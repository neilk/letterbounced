#!/bin/bash

set -e

# Build binary dictionary (now includes sorting internally)
cargo run --bin dictionary-builder -- --frequencies data/google-ngrams-words-all.txt > data/dictionary.bin

echo "✅ Binary dictionary built at data/dictionary.bin"