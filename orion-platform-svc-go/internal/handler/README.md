# handler (Generic Handler)

> **@deprecated** — This module is a utility stub that has been superseded.
>
> Generic HTTP handler utilities (DeleteHandler, TenantFunc, WriteError, etc.).
>
> **Replaced by**: All domain-specific handler packages (e.g., `internal/crossover/handler`, `internal/alert-adapter-v2/handler`)
>
> This directory exists only for backward compatibility with existing imports.
> New code should use the replacement listed above. This directory may be
> safely removed in a future major version.

## Files

| File | Purpose |
|------|---------|
| `generic.go` | // Package handler provides generic Gin handler middleware and wrapper |

## Migration

```go
// Before (deprecated):
import "orion/platform-svc-go/internal/handler"

// After (use replacement):
import "orion/go-common"
```

_Marked deprecated: 2026-08-09_
