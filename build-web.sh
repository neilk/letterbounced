#!/bin/bash
set -e

echo "🌐 Building WASM for web..."

# Build the WASM package
echo "📦 Building WASM package..."
wasm-pack build --target web --out-dir web/svelte-app/src/pkg

# Copy dictionary to svelte-app public directory
echo "📋 Copying dictionary..."
mkdir -p web/svelte-app/public
cp data/dictionary.txt web/svelte-app/public/

echo "✅ Web build complete!"
echo "🚀 WASM files are in 'web/svelte-app/src/pkg/'"
echo "💡 To develop: cd web/svelte-app && npm run dev"
echo "💡 To build: cd web/svelte-app && npm run build"