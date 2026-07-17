# Go Workspace Guide

## Overview

This project uses Go workspaces (`go.work`) to manage multiple Go modules under a
single development root. The workspace enables cross-module dependencies, shared
builds, and a unified development experience.

## Module Layout

```
/Users/heal/orion-design/
├── go.work                         # Workspace root
├── orion-platform-svc-go/          # Main platform service (module: orion/platform-svc-go)
│   ├── go.mod                      # Module definition
│   ├── cmd/server/                 # Entry point
│   ├── internal/                   # 60+ domain modules
│   ├── migrations/                 # SQL migrations
│   └── scripts/                    # CI/dev scripts
├── orion-go-common/                # Shared library (module: orion/go-common)
│   ├── go.mod                      # Module definition
│   └── pkg/                        # Shared packages (config, middleware, etc.)
└── (other orion-*-svc-go dirs)     # Future microservice blueprints
```

### Module Relationships

| Module | Path | Role |
|--------|------|------|
| `orion/platform-svc-go` | `./orion-platform-svc-go` | Main service — routes, handlers, domain logic |
| `orion/go-common` | `./orion-go-common` | Shared library — config, middleware, DB, RLS, cron |

The main service depends on `orion/go-common` for:
- Configuration loading (`pkg/config`)
- HTTP middleware (`pkg/middleware`)
- Database utilities & RLS (`pkg/database`)
- Cron scheduling (`pkg/cron`)

## Using the Workspace

### Prerequisites

- Go 1.25+
- PostgreSQL 15+ (for migrations & tests)
- Redis 7+ (for caching & sessions)
- NATS Server 2.x (for event streaming, optional)

### Initialize / Sync Workspace

From the repository root (`/Users/heal/orion-design/`):

```bash
# Activate the workspace (Go automatically detects go.work)
go env GOWORK    # Should output path to go.work

# Sync all go.sum files to match go.mod requirements
go work sync
```

`go work sync` ensures that every module's `go.sum` is consistent with the
workspace's aggregate view. Run this whenever you add or change a dependency
in any module.

### Build

```bash
# Build the main server binary
go build -o ./orion-platform-svc-go/bin/server ./orion-platform-svc-go/cmd/server

# Build all packages (no binary output)
go build ./orion-platform-svc-go/...
```

### Run Tests

```bash
# Run all tests
go test ./orion-platform-svc-go/...

# With race detection
go test -race ./orion-platform-svc-go/...

# With verbose output
go test -v ./orion-platform-svc-go/...

# With coverage
go test -coverprofile=coverage.out ./orion-platform-svc-go/...
go tool cover -html=coverage.out
```

### Lint & Vet

```bash
# Run go vet on all packages
go vet ./orion-platform-svc-go/...

# Run go fmt (must be inside module directory)
cd orion-platform-svc-go && go fmt ./...
```

## go work commands reference

| Command | Description |
|---------|-------------|
| `go work init` | Create a new workspace file |
| `go work use <module-path>` | Add a module to the workspace |
| `go work edit -drop=<path>` | Remove a module from the workspace |
| `go work sync` | Sync go.sum across all modules in the workspace |
| `go work edit` | Print the current workspace configuration |
| `go env GOWORK` | Show current workspace file path (empty = no workspace) |
| `GOWORK=off go ...` | Temporarily disable workspace mode |

## Adding a New Module to the Workspace

1. Create the module directory with its own `go.mod`:
   ```bash
   mkdir -p orion-<name>-svc-go
   cd orion-<name>-svc-go && go mod init orion/<name>-svc-go
   ```
2. Add it to the workspace from the repo root:
   ```bash
   go work edit -add=orion-<name>-svc-go
   go work sync
   ```
3. If the new module depends on `orion/go-common`, the workspace automatically
   resolves the cross-module dependency — no `replace` directive needed.

## Removing a Module from the Workspace

```bash
go work edit -drop=orion-<name>-svc-go
```

## Cross-Module Dependency Resolution

When a module (e.g. `orion/platform-svc-go`) imports a package from another
workspace module (e.g. `orion/go-common/pkg/config`), the workspace mode
automatically resolves the import using the local directory. This means:

- No `replace` directives are needed in `go.mod`.
- `go mod tidy` will not add remote references to workspace-resolved modules.
- If you need to build outside the workspace, use `go work sync` first to
  ensure `go.sum` is populated, then build with `GOWORK=off`.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `go: workspace not loaded` | Run `go env GOWORK` to confirm the file exists; run from the repo root |
| `cannot find module for path ...` | Run `go work sync` to refresh sums |
| Stale `go.sum` entries | Run `go work sync` then `go mod tidy` in each module |
| Module built outside workspace | Set `GOWORK=off` before building |

## CI/CD

See `scripts/ci.sh` for the standardized CI pipeline script, and
`.github/workflows/ci.yml` for the GitHub Actions workflow.
