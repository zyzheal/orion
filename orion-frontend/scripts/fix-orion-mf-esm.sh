#!/bin/bash
# Fix @orion-mf/core ESM compatibility issues in node_modules
# The package uses directory imports and missing .js extensions which break ESM resolution
# See: https://github.com/nicolo-ribaudo/tc39-proposal-import-meta

set -e

ORION_MF_DIR="node_modules/@orion-mf/core/dist"

if [ ! -d "$ORION_MF_DIR" ]; then
  exit 0
fi

# Fix dist/index.js: directory import
if [ -f "$ORION_MF_DIR/index.js" ]; then
  sed -i.bak "s|export \* from '\./core';|export * from './core/index.js';|" "$ORION_MF_DIR/index.js"
  sed -i.bak "s|export \* from \"./core\";|export * from './core/index.js';|" "$ORION_MF_DIR/index.js"
  rm -f "$ORION_MF_DIR/index.js.bak"
fi

# Fix all .js files in dist/core/: add .js to bare specifier imports
if [ -d "$ORION_MF_DIR/core" ]; then
  for f in "$ORION_MF_DIR/core"/*.js; do
    [ -f "$f" ] || continue
    # Fix single-quote imports: from './Foo' -> from './Foo.js'
    sed -i.bak "s/from '\(\.\/[^']*\)';$/from '\1.js';/g" "$f"
    sed -i.bak "s/from '\(\.\/[^']*\)'$/from '\1.js'/g" "$f"
    # Fix double-quote imports: from "./Foo" -> from "./Foo.js"
    sed -i.bak 's/from "\(\.\/[^"]*\)";$/from "\1.js";/g' "$f"
    sed -i.bak 's/from "\(\.\/[^"]*\)"$/from "\1.js"/g' "$f"
    # Fix double .js
    sed -i.bak "s/\.js\.js'/.js'/g" "$f"
    sed -i.bak 's/\.js\.js"/.js"/g' "$f"
    rm -f "$f.bak"
  done
fi
