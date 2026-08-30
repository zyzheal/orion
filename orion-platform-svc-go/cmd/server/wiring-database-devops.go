package main

import (
	"context"
	"fmt"
	"os"
	"strconv"

	"go.uber.org/zap"

	ds_models "orion/platform-svc-go/internal/datasource/models"
	dbdevops_service "orion/platform-svc-go/internal/database-devops/service"
	"orion/platform-svc-go/internal/infrastructure/backup/executor"
)

// wireDatabaseDevopsExecutors injects the executor registry and conn resolver
// into the database-devops handler so ExecuteBackup/ExecuteRestore perform real
// engine-specific operations instead of returning placeholder results.
func wireDatabaseDevopsExecutors(logger *zap.Logger) {
	if datasourceSvc == nil || dbdevopsH == nil {
		logger.Warn("database-devops executor wiring skipped: datasourceSvc or dbdevopsH is nil")
		return
	}

	reg := executor.NewRegistry()
	resolver := makeConnResolver(logger)

	dbdevopsH.SetExecutor(reg, resolver)
	dbdevopsH.SetBackupDir(backupDir())

	dialects := make([]string, 0, len(reg.BackupDialects()))
	for _, d := range reg.BackupDialects() {
		dialects = append(dialects, string(d))
	}
	logger.Info("database-devops executor wired", zap.Strings("dialects", dialects))
}

// makeConnResolver builds a ConnInfoResolver from the datasource service.
func makeConnResolver(logger *zap.Logger) dbdevops_service.ConnInfoResolver {
	return func(ctx context.Context, tenantID, databaseID string) (*executor.ConnInfo, executor.Dialect, error) {
		ds, err := datasourceSvc.Get(ctx, databaseID)
		if err != nil {
			return nil, "", fmt.Errorf("lookup datasource %s: %w", databaseID, err)
		}
		if ds == nil {
			return nil, "", fmt.Errorf("datasource %s not found", databaseID)
		}

		dialect, ok := mapDialect(ds.Type)
		if !ok {
			return nil, "", fmt.Errorf("unsupported datasource type %q for backup", ds.Type)
		}

		password, err := datasourceSvc.ResolvePassword(ctx, databaseID)
		if err != nil {
			return nil, "", fmt.Errorf("resolve password for %s: %w", databaseID, err)
		}

		conn := &executor.ConnInfo{
			Host:     ds.Host,
			Port:     strconv.Itoa(ds.Port),
			DB:       ds.Database,
			User:     ds.Username,
			Password: password,
			SSLMode:  ds.SSLMode,
		}
		return conn, dialect, nil
	}
}

func mapDialect(dsType ds_models.DataSourceType) (executor.Dialect, bool) {
	switch dsType {
	case ds_models.DSCPostgres:
		return executor.DialectPostgreSQL, true
	case ds_models.DSCMySQL:
		return executor.DialectMySQL, true
	default:
		return "", false
	}
}

func backupDir() string {
	if d := os.Getenv("BACKUP_DIR"); d != "" {
		return d
	}
	return "/var/backups/orion"
}
