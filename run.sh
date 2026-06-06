#!/bin/bash
# run.sh - Build and run 3x-ui panel locally

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== 1. Building Frontend ==="
cd frontend
npm install
npm run build
cd ..

echo "=== 2. Building Go Backend ==="
go build -o x-ui main.go

echo "=== 3. Starting x-ui Panel ==="
./x-ui
