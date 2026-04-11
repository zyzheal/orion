#!/bin/bash
# Orion Design - Initialization Script
# This script initializes the development environment

set -e

PROJECT_ROOT="/Users/heal/orion-design"
cd "$PROJECT_ROOT"

echo "=== Orion Design Initialization ==="

# Check for package.json and install dependencies if exists
if [ -f "package.json" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Set environment variables
export DEV_ENGINE_ENABLED=true
export PROJECT_ROOT="$PROJECT_ROOT"

# Create necessary directories if not exist
mkdir -p .dev-enegine
mkdir -p requirements/{functional,non-functional,user-stories,tracking}
mkdir -p docs
mkdir -p reports

echo "=== Initialization Complete ==="
echo "Project root: $PROJECT_ROOT"
echo "Dev Engine: Enabled"
