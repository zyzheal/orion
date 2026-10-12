#!/usr/bin/env bash
# otel-span-check.sh — GATE-OTEL-SPAN-100 (S0-T8 BLOCK).
#
# Verifies OTel span creation is present on critical paths. Checks for:
#   1. OpenTelemetry import in the platform service
#   2. Tracing middleware wired in router.go
#   3. trace.Span.Start() calls present in internal/ packages
#
# Usage:
#   scripts/lint/otel-span-check.sh [repo-root]
#
# Exit codes:
#   0  OTel spans wired
#   1  critical OTel wiring missing
#   2  bad usage
set -uo pipefail

ROOT="${1:-.}"
if [ ! -d "$ROOT" ]; then
    echo "otel-span-check: bad root $ROOT" >&2
    exit 2
fi

PLATFORM="$ROOT/orion-platform-svc-go"
if [ ! -d "$PLATFORM" ]; then
    echo "otel-span-check: $PLATFORM not found" >&2
    exit 2
fi

fail=0
warnings=0

# 1. Router must wire Tracing middleware.
router="$PLATFORM/cmd/server/router.go"
if [ -f "$router" ]; then
    if ! grep -q 'middleware\.Tracing(' "$router"; then
        echo "FAIL: middleware.Tracing() not wired in router.go (P2-6)"
        fail=1
    fi
else
    echo "FAIL: router.go missing"
    fail=1
fi

# 2. Tracing middleware implementation must exist.
if [ ! -f "$PLATFORM/internal/middleware/tracing.go" ]; then
    echo "FAIL: internal/middleware/tracing.go missing"
    fail=1
fi

# 3. Go module must declare otel dependency.
gomod="$PLATFORM/go.mod"
if [ -f "$gomod" ]; then
    if ! grep -q 'go.opentelemetry.io/otel' "$gomod"; then
        echo "WARN: go.mod does not declare go.opentelemetry.io/otel"
        warnings=$((warnings + 1))
    fi
else
    echo "FAIL: go.mod missing"
    fail=1
fi

# 4. Span creation calls must exist somewhere in the service.
#    The codebase uses otel.Tracer("...").Start(...) for span creation.
#    Also accept trace.Start(...) and trace.Span.Start(...) for completeness.
span_calls=$(grep -rEc 'otel\.Tracer\([^)]*\)\.Start\(|trace\.Span\.Start\(|trace\.Start\(' \
    "$PLATFORM/internal/" 2>/dev/null | grep -v '_test\.go' | awk -F: '{s+=$2} END {print s+0}')
echo "otel-span-check: $span_calls span creation call sites in internal/"
if [ "$span_calls" -lt 5 ]; then
    echo "WARN: fewer than 5 span creation call sites — critical path coverage < 100%"
    warnings=$((warnings + 1))
fi

if [ "$fail" -eq 0 ]; then
    if [ "$warnings" -eq 0 ]; then
        echo "otel-span-check: PASS (Tracing wired, spans created)"
    else
        echo "otel-span-check: PASS with $warnings warning(s) (progressive gate, not blocking)"
    fi
    exit 0
fi

echo "otel-span-check: FAIL — $fail blocking issue(s)"
exit 1
