# lock (Distributed Lock)

> **@deprecated** — This module is a utility stub that has been superseded.
>
> Redis/PostgreSQL distributed lock implementation.
>
> **Replaced by**: `go-common` shared library (`orion/go-common`) — used as a dependency, not an endpoint
>
> This directory exists only for backward compatibility with existing imports.
> New code should use the replacement listed above. This directory may be
> safely removed in a future major version.

## Files

| File | Purpose |
|------|---------|
| `lock.go` | package lock |

## Migration

```go
// Before (deprecated):
import "orion/platform-svc-go/internal/lock"

// After (use replacement):
import "`go-common`"
```

_Marked deprecated: 2026-08-09_
