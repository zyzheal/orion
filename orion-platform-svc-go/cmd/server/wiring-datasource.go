package main

import (
	"os"

	"go.uber.org/zap"

	"orion/go-common/pkg/database"

	ds_handler "orion/platform-svc-go/internal/datasource/handler"
	ds_repo "orion/platform-svc-go/internal/datasource/repository"
	ds_service "orion/platform-svc-go/internal/datasource/service"
)

// wireDatasource wires internal/datasource — before this the module had a
// service, a repository interface and models but nothing constructed the service
// and no HTTP route reached it, so it was dead code. The repository interface
// also had no implementation; sql.go provides it against data_sources.
func wireDatasource(db *database.DB, logger *zap.Logger) {
	repo := ds_repo.NewRepository(db.DB)

	key := datasourceKey(logger)

	svc := ds_service.New(repo, key, logger)
	datasourceH = ds_handler.NewHandler(svc)
}

var datasourceH *ds_handler.Handler

// datasourceKey resolves the AES-256 key every data source module encrypts
// credentials with. DATASOURCE_SECRET_KEY is the purpose-built setting; JWT_SECRET
// is accepted so an existing deployment needs no new variable; the final fallback
// is a development key that logs a warning — production must set DATASOURCE_SECRET_KEY.
//
// internal/database-devops calls this too (see wireMiddleware's caller in wiring.go),
// because ARCH-0.11's point is that both modules encrypt with one key: a credential
// created through /data-sources must stay decryptable if it is ever handed to
// /database-devops/data-sources, and two different fallbacks would quietly break that.
//
// The cost of the sharing is that a misconfigured environment logs the warning twice
// (once per module). That is deliberate: the duplicate line is the thing that makes
// the misconfiguration visible in the startup logs.
func datasourceKey(logger *zap.Logger) string {
	if key := os.Getenv("DATASOURCE_SECRET_KEY"); key != "" {
		return key
	}
	if key := os.Getenv("JWT_SECRET"); key != "" {
		logger.Warn("DATASOURCE_SECRET_KEY not set; reusing JWT_SECRET to encrypt datasource passwords")
		return key
	}
	logger.Warn("no DATASOURCE_SECRET_KEY or JWT_SECRET; using a development datasource encryption key")
	return "dev-datasource-key-change-me"
}
