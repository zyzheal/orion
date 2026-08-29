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

	// DATASOURCE_SECRET_KEY is the AES-256 key used to encrypt stored
	// datasource passwords. Anything non-empty is SHA-256'd to 32 bytes by the
	// service, so a passphrase works.
	key := os.Getenv("DATASOURCE_SECRET_KEY")
	if key == "" {
		key = os.Getenv("JWT_SECRET")
		if key != "" {
			logger.Warn("DATASOURCE_SECRET_KEY not set; reusing JWT_SECRET to encrypt datasource passwords")
		} else {
			key = "dev-datasource-key-change-me"
			logger.Warn("no DATASOURCE_SECRET_KEY or JWT_SECRET; using a development datasource encryption key")
		}
	}

	svc := ds_service.New(repo, key, logger)
	datasourceH = ds_handler.NewHandler(svc)
}

var datasourceH *ds_handler.Handler
