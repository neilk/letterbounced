#!/bin/bash

set -e 

cargo run --bin dictionary-builder -- --frequencies data/google-ngrams-words-all.txt > /tmp/dictionary.txt
sort -k 2,2rn -k 1 /tmp/dictionary.txt > data/dictionary.txt