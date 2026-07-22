#!/usr/bin/env bash
#
# CI pipeline for orion-platform-svc-go
#
# Usage:
#   scripts/ci.sh [--coverage]
#
# Options:
#   --coverage    Run with coverage profile and print summary
#
# Exit codes:
#   0  All checks passed
#   1  One or more checks failed
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODULE_NAME="orion/platform-svc-go"

COVERAGE_OUT="${PROJECT_ROOT}/coverage.out"
COVERAGE_RUN=false

if [[ "${1:-}" == "--coverage" ]]; then
    COVERAGE_RUN=true
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print step header
step() {
    echo -e "\n${YELLOW}==> $1${NC}"
}

# Print success
ok() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Print failure
fail() {
    echo -e "${RED}✗ $1${NC}"
    exit 1
}

# Check Go version
check_go() {
    local version
    version=$(go version | awk '{print $3}')
    echo "Go version: $version"
    if [[ "$version" != "go1.25"* ]]; then
        echo -e "${YELLOW}Warning: expected Go 1.25+, got $version${NC}"
    fi
}

# Run go fmt and check for changes
run_fmt() {
    step "go fmt"
    cd "$PROJECT_ROOT"
    if go fmt ./... | grep -q .; then
        echo -e "${YELLOW}Formatting applied${NC}"
    else
        ok "go fmt"
    fi
}

# Run go vet
run_vet() {
    step "go vet"
    cd "$PROJECT_ROOT"
    if go vet ./...; then
        ok "go vet"
    else
        fail "go vet"
    fi
}

# Run tests
run_tests() {
    step "go test (race, count=1)"
    cd "$PROJECT_ROOT"
    if go test ./... -count=1 -race; then
        ok "go test"
    else
        fail "go test"
    fi
}

# Run build
run_build() {
    step "go build"
    cd "$PROJECT_ROOT"
    if go build -trimpath -o /dev/null ./cmd/server; then
        ok "go build"
    else
        fail "go build"
    fi
}

# Run coverage
run_coverage() {
    step "go test (coverage)"
    cd "$PROJECT_ROOT"
    go test ./... -count=1 -coverprofile="$COVERAGE_OUT" -covermode=atomic -coverpkg=./... >/dev/null 2>&1 || true
    if [[ -f "$COVERAGE_OUT" ]]; then
        echo -e "\n${YELLOW}Coverage Summary${NC}"
        go tool cover -func="$COVERAGE_OUT" | tail -1
        local total
        total=$(go tool cover -func="$COVERAGE_OUT" | tail -1 | awk '{print $2}')
        echo -e "Total coverage: ${GREEN}${total}${NC}"
        echo -e "\nPer-package coverage:"
        go tool cover -func="$COVERAGE_OUT" | grep "pkg" | head -30 || true
        rm -f "$COVERAGE_OUT"
        ok "coverage"
    else
        fail "coverage"
    fi
}

# Main pipeline
main() {
    echo "============================================"
    echo " Orion Platform Service Go — CI Pipeline"
    echo "============================================"

    check_go
    run_fmt
    run_vet
    run_tests
    run_build

    if $COVERAGE_RUN; then
        run_coverage
    fi

    echo -e "\n${GREEN}============================================${NC}"
    echo -e "${GREEN} All checks passed${NC}"
    echo -e "${GREEN}============================================${NC}"
}

main "$@"
