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

// datasourceKey resolves the AES-256 key internal/datasource encrypts credentials
// with. DATASOURCE_SECRET_KEY is the purpose-built setting; JWT_SECRET is accepted
// so an existing deployment needs no new variable; the final fallback is a
// development key that logs a warning — production must set DATASOURCE_SECRET_KEY.
//
// Before ARCH-0.11b, internal/database-devops also called this function because it
// had its own duplicate /database-devops/data-sources surface. That surface was
// removed in ARCH-0.11b — data source management now lives solely in
// internal/datasource, so only wireDatasource calls datasourceKey.
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
