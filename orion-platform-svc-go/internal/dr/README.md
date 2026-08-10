# dr (Direct Response)

> **@deprecated** — This module is a utility stub that has been superseded.
>
> Direct HTTP response helper utilities (Respond, RespondCreated, etc.).
>
> **Replaced by**: `internal/middleware/response.go` (RespondSuccess, RespondCreated, RespondPaginated, RespondServiceUnavailable)
>
> This directory exists only for backward compatibility with existing imports.
> New code should use the replacement listed above. This directory may be
> safely removed in a future major version.

## Files

| File | Purpose |
|------|---------|
| `response_writer.go` | package dr |
| `config/config.go` | package config |
| `internal/response_writer.go` | package internal |
| `internal/config/config.go` | package config |

## Migration

```go
// Before (deprecated):
import "orion/platform-svc-go/internal/dr"

// After (use replacement):
import "`internal/middleware/response.go`"
```

_Marked deprecated: 2026-08-09_
