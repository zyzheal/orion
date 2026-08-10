# migration (DB Migration)

> **@deprecated** — This module is a utility stub that has been superseded.
>
> Database migration version tracking (VersionRecord, DBVersionRecord).
>
> **Replaced by**: SQL migration files in `orion-platform-svc/db/migrations/` + `sqlx` direct execution
>
> This directory exists only for backward compatibility with existing imports.
> New code should use the replacement listed above. This directory may be
> safely removed in a future major version.

## Files

| File | Purpose |
|------|---------|
| `version.go` | package migration |

## Migration

```go
// Before (deprecated):
import "orion/platform-svc-go/internal/migration"

// After (use replacement):
import "orion/go-common"
```

_Marked deprecated: 2026-08-09_
